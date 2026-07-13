import { API_URL } from '../../config';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, CreditCard, Banknote, Coffee, UtensilsCrossed, Croissant, Plus, Minus, CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';

export default function QRMenu() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/menu/public`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(data => setMenuItems(data))
      .catch(console.error);

    const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/public`, {
      transports: ['websocket']
    });
    socket.on('menu:updated', () => {
      fetch(`${API_URL}/api/menu/public`)
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
        customerName: customerName.trim(),
        tableNumber,
        clientCalculatedTotal: total
      };

      // Simulate payment delay if online
      if (isPaidOnline) {
        // MOCK PAYMENT GATEWAY: Generate a fake intent token
        payload.paymentIntentId = `pi_${crypto.randomUUID()}`;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const res = await fetch(`${API_URL}/api/orders/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setOrderSuccess(data);
        setCart([]);
      } else {
        if (res.status === 409) {
          alert('Menu prices have been updated! Please review the new prices before ordering.');
          // Refresh menu to show new prices
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/public`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => { setMenuItems(data); setIsCheckingOut(false); })
            .catch(console.error);
        } else {
          alert('Failed to place order.');
        }
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[var(--color-meza-bg)] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 bg-[var(--color-success)]/20 text-[var(--color-success)] rounded-full flex items-center justify-center mb-6 ">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-meza-text)] mb-2 tracking-tight">Order Placed!</h1>
        <p className="text-[var(--color-meza-muted)] mb-8">Your order #{orderSuccess._id.slice(-4).toUpperCase()} is being prepared for Table {tableNumber}.</p>
        
        <div className="bg-[var(--color-meza-surface)] p-6 rounded-sm  border border-[var(--color-meza-border)] w-full max-w-sm mb-8 text-left space-y-4">
          {orderSuccess.status === 'unpaid' && (
            <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-yellow-800 p-4 rounded-sm text-sm font-bold mb-4 flex flex-col items-center text-center">
              <span>Payment Pending</span>
              <span className="text-xs font-medium text-[var(--color-warning)] mt-1">Please pay ₱{orderSuccess.total.toFixed(2)} at the counter.</span>
            </div>
          )}
          {orderSuccess.status === 'completed' && (
            <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-green-800 p-3 rounded-sm text-sm font-bold mb-4 text-center">
              Paid via Online
            </div>
          )}
          <ul className="space-y-3">
            {orderSuccess.items.map((i, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span className="font-bold text-[var(--color-meza-text)]">{i.quantity}x {i.nameAtSale}</span>
                <span className="font-medium text-[var(--color-meza-muted)]">₱{(i.priceAtSale * i.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-dashed border-[var(--color-meza-border)] pt-3 flex justify-between font-bold text-lg text-[var(--color-meza-text)]">
            <span>Total</span>
            <span>₱{orderSuccess.total.toFixed(2)}</span>
          </div>
        </div>

        <button onClick={() => setOrderSuccess(null)} className="font-bold text-[var(--color-meza-primary)] py-3 px-6 rounded-sm hover:bg-[var(--color-meza-primary)]/5 transition-colors">
          Place Another Order
        </button>
      </div>
    );
  }

  if (isCheckingOut) {
    return (
      <div className="min-h-screen bg-[var(--color-meza-bg)] font-sans flex flex-col">
        <header className="bg-[var(--color-meza-surface)] p-4 flex items-center  sticky top-0 z-10">
          <button onClick={() => setIsCheckingOut(false)} className="p-2 -ml-2 text-[var(--color-meza-muted)]"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold text-[var(--color-meza-text)] ml-2">Checkout Table {tableNumber}</h1>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-6 max-w-md mx-auto w-full">
          <div className="bg-[var(--color-meza-surface)] rounded-sm  border border-[var(--color-meza-border)] p-4">
            <h2 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest mb-4">Your Order</h2>
            <ul className="space-y-4">
              {cart.map(item => (
                <li key={item._id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="font-bold text-[var(--color-meza-text)] block">{item.name}</span>
                    <span className="text-xs font-medium text-[var(--color-meza-muted)]">₱{item.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center space-x-3 bg-[var(--color-meza-bg)] rounded-sm p-1 border border-[var(--color-meza-border)]">
                    <button onClick={() => updateQuantity(item._id, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-meza-surface)]  border border-[var(--color-meza-border)]"><Minus className="w-3 h-3"/></button>
                    <span className="w-4 text-center font-bold text-sm text-[var(--color-meza-text)]">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._id, 1)} className="w-7 h-7 flex items-center justify-center rounded bg-[var(--color-meza-surface)]  border border-[var(--color-meza-border)]"><Plus className="w-3 h-3"/></button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-dashed border-[var(--color-meza-border)] mt-4 pt-4 flex justify-between font-bold text-xl text-[var(--color-meza-text)]">
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-[var(--color-meza-surface)] rounded-sm  border border-[var(--color-meza-border)] p-4">
            <h2 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest mb-4">Your Details</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--color-meza-text)] uppercase tracking-widest ml-1">Name <span className="text-[var(--color-danger)]">*</span></label>
              <input 
                type="text" 
                placeholder="Required for identifying your order" 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)} 
                className={`w-full bg-[var(--color-meza-bg)] border-2 rounded-sm px-4 py-3 outline-none focus:border-[var(--color-meza-primary)] font-bold transition-colors ${!customerName.trim() ? 'border-[var(--color-warning)]/30' : 'border-[var(--color-meza-border)]'}`} 
              />
            </div>
          </div>

          <div className="bg-[var(--color-meza-surface)] rounded-sm  border border-[var(--color-meza-border)] p-4">
            <h2 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest mb-4">Payment Method</h2>
            <div className="grid gap-3">
              <button 
                onClick={() => setPaymentMethod('online')} 
                className={`w-full p-4 rounded-sm border-2 flex items-center transition-all ${paymentMethod === 'online' ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/5' : 'border-[var(--color-meza-border)]'}`}
              >
                <div className={`p-2 rounded-full mr-3 ${paymentMethod === 'online' ? 'bg-[var(--color-meza-primary)] text-white' : 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)]'}`}><CreditCard className="w-5 h-5" /></div>
                <div className="text-left"><span className="block font-bold text-[var(--color-meza-text)]">Pay Now (Online)</span><span className="block text-xs text-[var(--color-meza-muted)]">GCash, Maya, Visa, Mastercard</span></div>
              </button>
              <button 
                onClick={() => setPaymentMethod('counter')} 
                className={`w-full p-4 rounded-sm border-2 flex items-center transition-all ${paymentMethod === 'counter' ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/5' : 'border-[var(--color-meza-border)]'}`}
              >
                <div className={`p-2 rounded-full mr-3 ${paymentMethod === 'counter' ? 'bg-[var(--color-meza-primary)] text-white' : 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)]'}`}><Banknote className="w-5 h-5" /></div>
                <div className="text-left"><span className="block font-bold text-[var(--color-meza-text)]">Pay at Counter</span><span className="block text-xs text-[var(--color-meza-muted)]">Cash or Card at the register</span></div>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-meza-surface)] border-t border-[var(--color-meza-border)] p-4 pb-8 sticky bottom-0">
          <button 
            onClick={submitOrder} 
            disabled={isProcessing || !customerName.trim()}
            className="w-full max-w-md mx-auto block py-4 bg-meza-text hover:bg-black text-white rounded-sm font-bold tracking-wider uppercase  transition-transform active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : `Place Order • ₱${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-meza-bg)] font-sans pb-24">
      {/* Header */}
      <header className="bg-[var(--color-meza-surface)] px-6 pt-8 pb-6  sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">meza.</h1>
            <p className="text-sm font-bold text-[var(--color-meza-muted)]">Table {tableNumber}</p>
          </div>
          
          {tableNumber === 'Kiosk' && (
            <div className="flex bg-[var(--color-meza-bg)] p-1 rounded-sm">
              <button onClick={() => navigate('/cashier')} className="px-3 py-1.5 rounded-sm text-xs font-bold text-[var(--color-meza-muted)] hover:text-[var(--color-meza-text)] tap-scale">Cashier</button>
              <button className="px-3 py-1.5 rounded-sm bg-[var(--color-meza-surface)]  text-xs font-bold text-[var(--color-meza-text)] tap-scale">Ordering</button>
              <button onClick={() => navigate('/kds')} className="px-3 py-1.5 rounded-sm text-xs font-bold text-[var(--color-meza-muted)] hover:text-[var(--color-meza-text)] tap-scale">KDS</button>
            </div>
          )}
        </div>
        
        {/* Categories (Horizontal Scroll) */}
        <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-meza-text text-white ' : 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)]'}`}
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
              <div key={item._id} className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-[var(--color-meza-border)] overflow-hidden flex flex-col transition-transform hover:scale-[1.01]">
                {/* Image Section */}
                {item.photoUrl ? (
                  <div className="w-full h-40 bg-[var(--color-meza-bg)] overflow-hidden relative group">
                    <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {item.category === 'Drinks' ? <Coffee className="w-5 h-5 absolute top-3 right-3 text-white drop- opacity-80"/> : item.category === 'Food' ? <UtensilsCrossed className="w-5 h-5 absolute top-3 right-3 text-white drop- opacity-80"/> : <Croissant className="w-5 h-5 absolute top-3 right-3 text-white drop- opacity-80"/>}
                  </div>
                ) : (
                  <div className="w-full h-28 bg-[var(--color-meza-bg)] flex items-center justify-center text-[var(--color-meza-muted)]">
                    {item.category === 'Drinks' ? <Coffee className="w-8 h-8"/> : item.category === 'Food' ? <UtensilsCrossed className="w-8 h-8"/> : <Croissant className="w-8 h-8"/>}
                  </div>
                )}
                
                {/* Content Section */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--color-meza-text)] text-lg leading-tight">{item.name}</h3>
                    {item.description && <p className="text-xs text-[var(--color-meza-muted)] font-medium mt-1.5 leading-snug line-clamp-2">{item.description}</p>}
                  </div>
                  
                  <div className="mt-4 flex justify-between items-center pt-3 border-t border-gray-50">
                    <p className="font-bold text-[var(--color-meza-text)] text-lg tracking-tight">₱{item.price.toFixed(2)}</p>
                    
                    {inCart ? (
                      <div className="flex items-center space-x-3 bg-[var(--color-meza-bg)] rounded-sm p-1 border border-[var(--color-meza-border)] ">
                        <button onClick={() => updateQuantity(item._id, -1)} className="w-8 h-8 flex items-center justify-center rounded-sm bg-[var(--color-meza-surface)]  font-bold text-[var(--color-meza-text)]">-</button>
                        <span className="w-4 text-center font-bold text-sm text-[var(--color-meza-text)]">{inCart.quantity}</span>
                        <button onClick={() => updateQuantity(item._id, 1)} className="w-8 h-8 flex items-center justify-center rounded-sm bg-[var(--color-meza-primary)] text-white  font-bold">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="px-4 py-2 bg-[var(--color-meza-bg)] hover:bg-meza-text hover:text-white rounded-sm flex items-center space-x-1 transition-all text-[var(--color-meza-text)] font-bold ">
                        <Plus className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Add</span>
                      </button>
                    )}
                  </div>
                </div>
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
            className="w-full bg-meza-text hover:bg-black text-white py-5 rounded-sm font-bold tracking-widest  flex justify-between items-center px-6 transition-all active:scale-95 hover-lift tap-scale"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-[var(--color-meza-surface)]/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold animate-pulse">{cart.reduce((s,i)=>s+i.quantity,0)}</div>
              <span className="uppercase text-sm">View Order</span>
            </div>
            <span className="text-xl tracking-tight">₱{total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
