import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronLeft, CreditCard, Banknote, Coffee, UtensilsCrossed, Croissant, Plus, Minus, CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';

export default function QRMenu() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu/public`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(data => setMenuItems(data))
      .catch(console.error);

    const socket = io(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`);
    socket.on('menu:updated', () => {
      fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu/public`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(data => setMenuItems(data));
    });

    return () => socket.disconnect();
  }, []);

  const categories = ['All', ...new Set(menuItems.map(i => i.category))];
  const filteredMenu = menuItems.filter(i => activeCategory === 'All' || i.category === activeCategory);

  const addToCart = (item) => {
    const existing = cart.find(c => c._id === item._id);
    if (existing) {
      setCart(cart.map(c => c._id === item._id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1, note: '' }]);
    }
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c._id === id) {
        const newQ = c.quantity + delta;
        return newQ > 0 ? { ...c, quantity: newQ } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const submitOrder = async () => {
    setIsProcessing(true);
    try {
      const isPaidOnline = paymentMethod === 'online';
      
      const payload = {
        localUUID: crypto.randomUUID(),
        items: cart.map(i => ({ menuItemId: i._id, quantity: i.quantity, note: i.note || '' })),
        paymentMethod: isPaidOnline ? 'online' : 'cash', // 'cash' means pay at counter later
        isPaidOnline,
        tableNumber
      };

      // Simulate payment delay if online
      if (isPaidOnline) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setOrderSuccess(data);
        setCart([]);
      } else {
        alert('Failed to place order.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[#fcf9f5] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-meza-text mb-2 tracking-tight">Order Placed!</h1>
        <p className="text-gray-500 mb-8">Your order #{orderSuccess._id.slice(-4).toUpperCase()} is being prepared for Table {tableNumber}.</p>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm mb-8 text-left space-y-4">
          {orderSuccess.status === 'unpaid' && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm font-bold mb-4 flex flex-col items-center text-center">
              <span>Payment Pending</span>
              <span className="text-xs font-medium text-yellow-600 mt-1">Please pay ₱{orderSuccess.total.toFixed(2)} at the counter.</span>
            </div>
          )}
          {orderSuccess.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-sm font-bold mb-4 text-center">
              Paid via Online
            </div>
          )}
          <ul className="space-y-3">
            {orderSuccess.items.map((i, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span className="font-bold text-meza-text">{i.quantity}x {i.nameAtSale}</span>
                <span className="font-medium text-gray-500">₱{(i.priceAtSale * i.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between font-black text-lg text-meza-text">
            <span>Total</span>
            <span>₱{orderSuccess.total.toFixed(2)}</span>
          </div>
        </div>

        <button onClick={() => setOrderSuccess(null)} className="font-bold text-meza-primary py-3 px-6 rounded-xl hover:bg-meza-primary/5 transition-colors">
          Place Another Order
        </button>
      </div>
    );
  }

  if (isCheckingOut) {
    return (
      <div className="min-h-screen bg-[#f4f1eb] font-sans flex flex-col">
        <header className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
          <button onClick={() => setIsCheckingOut(false)} className="p-2 -ml-2 text-gray-500"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-black text-meza-text ml-2">Checkout Table {tableNumber}</h1>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-6 max-w-md mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Order</h2>
            <ul className="space-y-4">
              {cart.map(item => (
                <li key={item._id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="font-bold text-meza-text block">{item.name}</span>
                    <span className="text-xs font-medium text-gray-500">₱{item.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-1 border border-gray-100">
                    <button onClick={() => updateQuantity(item._id, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-white shadow-sm border border-gray-200"><Minus className="w-3 h-3"/></button>
                    <span className="w-4 text-center font-bold text-sm text-meza-text">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._id, 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white shadow-sm border border-gray-200"><Plus className="w-3 h-3"/></button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-dashed border-gray-200 mt-4 pt-4 flex justify-between font-black text-xl text-meza-text">
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Payment Method</h2>
            <div className="grid gap-3">
              <button 
                onClick={() => setPaymentMethod('online')} 
                className={`w-full p-4 rounded-xl border-2 flex items-center transition-all ${paymentMethod === 'online' ? 'border-meza-primary bg-meza-primary/5' : 'border-gray-100'}`}
              >
                <div className={`p-2 rounded-full mr-3 ${paymentMethod === 'online' ? 'bg-meza-primary text-white' : 'bg-gray-100 text-gray-400'}`}><CreditCard className="w-5 h-5" /></div>
                <div className="text-left"><span className="block font-bold text-meza-text">Pay Now (Online)</span><span className="block text-xs text-gray-500">GCash, Maya, Visa, Mastercard</span></div>
              </button>
              <button 
                onClick={() => setPaymentMethod('counter')} 
                className={`w-full p-4 rounded-xl border-2 flex items-center transition-all ${paymentMethod === 'counter' ? 'border-meza-primary bg-meza-primary/5' : 'border-gray-100'}`}
              >
                <div className={`p-2 rounded-full mr-3 ${paymentMethod === 'counter' ? 'bg-meza-primary text-white' : 'bg-gray-100 text-gray-400'}`}><Banknote className="w-5 h-5" /></div>
                <div className="text-left"><span className="block font-bold text-meza-text">Pay at Counter</span><span className="block text-xs text-gray-500">Cash or Card at the register</span></div>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-gray-200 p-4 pb-8 sticky bottom-0">
          <button 
            onClick={submitOrder} 
            disabled={isProcessing}
            className="w-full max-w-md mx-auto block py-4 bg-meza-text hover:bg-black text-white rounded-2xl font-bold tracking-wider uppercase shadow-xl transition-transform active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : `Place Order • ₱${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1eb] font-sans pb-24">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-6 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-meza-text tracking-tight">meza.</h1>
            <p className="text-sm font-bold text-gray-400">Table {tableNumber}</p>
          </div>
          
          {tableNumber === 'Kiosk' && (
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => navigate('/cashier')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 tap-scale">Cashier</button>
              <button className="px-3 py-1.5 rounded-lg bg-white shadow-sm text-xs font-bold text-meza-text tap-scale">Ordering</button>
              <button onClick={() => navigate('/kds')} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 tap-scale">KDS</button>
            </div>
          )}
        </div>
        
        {/* Categories (Horizontal Scroll) */}
        <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-meza-text text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Menu Grid */}
      <main className="p-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMenu.map(item => {
            const inCart = cart.find(c => c._id === item._id);
            return (
              <div key={item._id} className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgb(0,0,0,0.03)] border border-gray-100 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                    {item.category === 'Drinks' ? <Coffee className="w-6 h-6"/> : item.category === 'Food' ? <UtensilsCrossed className="w-6 h-6"/> : <Croissant className="w-6 h-6"/>}
                  </div>
                  <div>
                    <h3 className="font-bold text-meza-text">{item.name}</h3>
                    <p className="font-black text-meza-primary">₱{item.price.toFixed(2)}</p>
                  </div>
                </div>
                
                {inCart ? (
                  <div className="flex items-center space-x-3 bg-gray-50 rounded-xl p-1.5 border border-gray-100">
                    <button onClick={() => updateQuantity(item._id, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm font-bold">-</button>
                    <span className="w-4 text-center font-bold text-sm text-meza-text">{inCart.quantity}</span>
                    <button onClick={() => updateQuantity(item._id, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-meza-primary text-white shadow-sm font-bold">+</button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(item)} className="w-10 h-10 bg-gray-50 hover:bg-meza-primary hover:text-white rounded-xl flex items-center justify-center transition-colors text-gray-500 font-bold">
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating View Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-6 z-20 max-w-md mx-auto">
          <button 
            onClick={() => setIsCheckingOut(true)}
            className="w-full bg-meza-text hover:bg-black text-white py-5 rounded-3xl font-black tracking-widest shadow-2xl flex justify-between items-center px-6 transition-all active:scale-95 hover-lift tap-scale"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold animate-pulse">{cart.reduce((s,i)=>s+i.quantity,0)}</div>
              <span className="uppercase text-sm">View Order</span>
            </div>
            <span className="text-xl tracking-tight">₱{total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
