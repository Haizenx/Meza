import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, LogOut, CheckCircle, CreditCard, Banknote, Coffee, UtensilsCrossed, Croissant, Trash2, X, Play, SquareTerminal, WifiOff, Wifi, Printer, Search, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { openDB } from 'idb';
import { io } from 'socket.io-client';

export default function CashierMode() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  
  // Shift & Connection State
  const [currentShift, setCurrentShift] = useState(null);
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [isEndingShift, setIsEndingShift] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [socket, setSocket] = useState(null);

  // POS State
  const [cart, setCart] = useState([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState('order'); // 'order' | 'unpaid' | 'kitchen'
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [unpaidOrders, setUnpaidOrders] = useState([]);
  
  // Security Modal State (Manager PIN)
  const [pinModal, setPinModal] = useState({ isOpen: false, action: null, payload: null });
  const [pinInput, setPinInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Initialize DB and Sync Loop
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); flushPendingOrders(); };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for pending orders
    checkPendingCount();
    
    // Sync loop every 30s just in case
    const syncInterval = setInterval(flushPendingOrders, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [token]);

  // Socket & Data Fetch
  useEffect(() => {
    if (!token) return;

    // Connect authenticated socket
    const newSocket = io(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`, {
      auth: { token }
    });

    newSocket.on('menu:updated', () => fetchMenu());
    newSocket.on('inventory:low_stock', (data) => console.warn('Low stock alert:', data));
    
    newSocket.on('kds:new_order', () => { fetchKitchenOrders(); fetchUnpaidOrders(); });
    newSocket.on('kds:update_status', () => fetchKitchenOrders());
    newSocket.on('order:updated', () => fetchUnpaidOrders());

    setSocket(newSocket);

    // Initial fetches
    fetchShift();
    fetchMenu();
    fetchKitchenOrders();
    fetchUnpaidOrders();

    return () => newSocket.disconnect();
  }, [token]);

  const fetchShift = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/shifts/current`, { headers: { 'Authorization': `Bearer ${token}` } });
      const shift = await res.json();
      if (shift && shift._id) {
        setCurrentShift(shift);
      } else {
        setIsStartingShift(true);
      }
    } catch (e) { console.error("Shift fetch error", e); }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setMenuItems(data.filter(i => !i.isArchived));
    } catch (e) { console.error("Menu fetch error", e); }
  };

  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders/kds/active`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setKitchenOrders(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Kitchen fetch error", e); }
  };

  const fetchUnpaidOrders = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders/unpaid`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setUnpaidOrders(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Unpaid orders fetch error", e); }
  };

  const markAsPaid = async (orderId, method) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/orders/${orderId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ paymentMethod: method })
      });
      if (res.ok) fetchUnpaidOrders();
    } catch (e) { console.error(e); }
  };

  const updateKitchenStatus = async (orderId, newStatus) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/orders/${orderId}/kds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ fulfillmentStatus: newStatus })
      });
      // Optimistic UI handled by socket
    } catch (e) { console.error(e); }
  };

  // --- INDEXEDDB OFFLINE LOGIC ---
  const initDB = async () => {
    return openDB('meza-pos', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pendingOrders')) {
          db.createObjectStore('pendingOrders', { keyPath: 'localUUID' });
        }
      },
    });
  };

  const checkPendingCount = async () => {
    const db = await initDB();
    const count = await db.count('pendingOrders');
    setPendingOrdersCount(count);
  };

  const saveOrderOffline = async (orderPayload) => {
    const db = await initDB();
    await db.put('pendingOrders', { ...orderPayload, syncStatus: 'pending', retryCount: 0 });
    checkPendingCount();
  };

  const flushPendingOrders = async () => {
    if (!navigator.onLine) return;
    
    // Check real connectivity
    try {
      await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu`, { method: 'HEAD', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (e) {
      return; // Truly offline
    }

    const db = await initDB();
    const orders = await db.getAll('pendingOrders');
    
    for (let order of orders) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(order)
        });
        
        if (res.ok) {
          await db.delete('pendingOrders', order.localUUID);
        } else if (res.status >= 400 && res.status < 500) {
          // Bad request (validation failed), don't retry forever. Mark failed or delete.
          await db.delete('pendingOrders', order.localUUID);
          console.error(`Order ${order.localUUID} rejected by server:`, await res.text());
        }
      } catch (err) {
        // Network error during flush, increment retry
        order.retryCount += 1;
        await db.put('pendingOrders', order);
      }
    }
    checkPendingCount();
  };

  // --- LOCAL PRINT MOCK ---
  const printReceipt = async (order) => {
    try {
      await fetch('http://localhost:8080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      console.log('Print job sent successfully');
    } catch (err) {
      console.warn('Local print service not reachable. Simulating print success for fallback.');
    }
  };

  // --- CHECKOUT LOGIC ---
  const processCheckout = async () => {
    // Generate idempotency key instantly
    const localUUID = crypto.randomUUID();
    
    // Note: total is computed strictly server-side. We send it just for fallback/reference if needed, but backend ignores it.
    const orderPayload = {
      localUUID,
      shiftId: currentShift?._id,
      items: cart.map(i => ({ menuItemId: i._id, quantity: i.quantity, note: i.note || '' })),
      paymentMethod,
      cashTendered: paymentMethod === 'cash' ? parseFloat(cashTendered || 0) : 0,
      createdAtLocal: new Date().toISOString()
    };

    // 1. Save to Offline DB immediately
    await saveOrderOffline(orderPayload);
    
    // 2. Clear Cart & Close Modal
    setCart([]);
    setIsCheckingOut(false);
    setCashTendered('');
    
    // 3. Attempt Sync immediately
    flushPendingOrders();
    
    // 4. Print Receipt
    printReceipt(orderPayload);
    
    alert('Payment Successful! Order saved.');
  };

  // --- SECURITY / PIN VERIFICATION ---
  const requestManagerPin = (action, payload) => {
    setPinModal({ isOpen: true, action, payload });
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: pinInput })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        // PIN Approved
        if (pinModal.action === 'void') {
          setCart([]);
          alert('Order voided successfully.');
        } else if (pinModal.action === 'discount') {
          setDiscountAmount(pinModal.payload);
          alert('Discount applied successfully.');
        }
        setPinModal({ isOpen: false, action: null, payload: null });
        setPinInput('');
      } else {
        alert(data.message || 'Invalid PIN');
        setPinInput('');
      }
    } catch (err) {
      alert('Error verifying PIN');
    }
  };

  // --- CART LOGIC ---
  const addToCart = (item) => {
    if (!item.isAvailable) return;
    const existing = cart.find(c => c._id === item._id);
    if (existing) {
      setCart(cart.map(c => c._id === item._id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1, note: '' }]);
    }
  };

  const updateCartItem = (id, delta, note = undefined) => {
    setCart(cart.map(item => {
      if (item._id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ, note: note !== undefined ? note : item.note } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i._id !== id));

  // --- SHIFT LOGIC ---
  const handleStartShift = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/shifts/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ startingCash: parseFloat(startingCashInput) })
      });
      if (res.ok) {
        setCurrentShift(await res.json());
        setIsStartingShift(false);
      } else {
        alert('Failed to start shift');
      }
    } catch (err) { alert('Error starting shift'); }
  };

  const handleEndShift = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/shifts/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ actualCash: parseFloat(actualCashInput) })
      });
      logout();
      navigate('/login');
    } catch (err) { alert('Error closing shift'); }
  };

  // --- RENDER HELPERS ---
  const filteredMenu = menuItems.filter(i => 
    (activeCategory === 'All' || i.category === activeCategory) &&
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - discountAmount);
  const changeDue = paymentMethod === 'cash' && cashTendered ? Math.max(0, parseFloat(cashTendered) - total) : 0;

  return (
    <div className="flex h-screen bg-[#f4f1eb] font-sans antialiased relative">
      
      {/* SHIFT GATES */}
      {isStartingShift && (
        <div className="absolute inset-0 bg-meza-text/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <form onSubmit={handleStartShift} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4"><Play className="w-6 h-6" /></div>
            <h2 className="text-2xl font-black text-meza-text mb-1">Start Shift</h2>
            <p className="text-sm text-gray-500 mb-6">Enter starting cash float.</p>
            <input type="number" step="0.01" min="0" required value={startingCashInput} onChange={e=>setStartingCashInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="₱0.00" />
            <button type="submit" className="w-full py-3 bg-meza-primary text-white rounded-xl font-bold">Open Register</button>
          </form>
        </div>
      )}

      {isEndingShift && (
        <div className="absolute inset-0 bg-meza-text/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <form onSubmit={handleEndShift} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4"><SquareTerminal className="w-6 h-6" /></div>
            <h2 className="text-2xl font-black text-meza-text mb-1">Close Register</h2>
            <p className="text-sm text-gray-500 mb-6">Count actual cash in drawer.</p>
            <input type="number" step="0.01" min="0" required value={actualCashInput} onChange={e=>setActualCashInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="₱0.00" />
            <div className="flex space-x-3">
              <button type="button" onClick={()=>setIsEndingShift(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">End Shift</button>
            </div>
          </form>
        </div>
      )}

      {/* PIN MODAL */}
      {pinModal.isOpen && (
        <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
          <form onSubmit={handlePinSubmit} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 text-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6" /></div>
            <h2 className="text-xl font-black text-meza-text mb-2">Manager PIN Required</h2>
            <p className="text-sm text-gray-500 mb-6">Authorize this action.</p>
            <input type="password" required autoFocus value={pinInput} onChange={e=>setPinInput(e.target.value)} className="w-full text-center tracking-widest text-2xl px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="••••" maxLength={4} />
            <div className="flex space-x-3">
              <button type="button" onClick={()=>setPinModal({isOpen:false})} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">Verify</button>
            </div>
          </form>
        </div>
      )}

      {/* LEFT: POS GRID */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${(isStartingShift || pinModal.isOpen) ? 'blur-md pointer-events-none' : ''}`}>
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-black text-meza-text hidden md:block">meza.</h1>
            
            {/* App Switcher */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button className="px-4 py-1.5 rounded-lg bg-white shadow-sm text-sm font-bold text-meza-text tap-scale">Cashier</button>
              <button onClick={() => navigate('/table/Kiosk')} className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 tap-scale">Ordering</button>
              <button onClick={() => navigate('/kds')} className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 tap-scale">KDS</button>
            </div>
            
            {/* Search */}
            <div className="relative hidden md:block ml-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search menu..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm outline-none focus:border-meza-primary" />
            </div>

          </div>
          
          <div className="flex items-center space-x-4 shrink-0">
            {/* Network / Sync Status */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg">
              {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              <span className="text-[10px] font-bold uppercase text-gray-500">{pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : 'Synced'}</span>
            </div>

            <button onClick={() => setIsEndingShift(true)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[11px] font-bold uppercase"><SquareTerminal className="w-3.5 h-3.5" /><span>Close Register</span></button>
            <button onClick={() => navigate('/login')} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Categories (Horizontal Scroll) */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex space-x-3 overflow-x-auto no-scrollbar shadow-sm">
          {['All', ...new Set(menuItems.map(i => i.category))].map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-meza-text text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenu.map(item => (
              <div key={item._id} onClick={() => addToCart(item)} className={`bg-white rounded-xl p-5 border shadow-sm transition-all cursor-pointer flex flex-col justify-between active:scale-95 min-h-[140px] ${!item.isAvailable ? 'opacity-40 grayscale pointer-events-none border-gray-200' : 'hover:-translate-y-0.5 hover:shadow-md border-gray-200'}`}>
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-lg bg-gray-50 text-meza-primary">
                    {item.category === 'Drinks' ? <Coffee className="w-6 h-6"/> : item.category === 'Food' ? <UtensilsCrossed className="w-6 h-6"/> : <Croissant className="w-6 h-6"/>}
                  </div>
                  <span className="text-lg font-black text-meza-text tracking-tight">₱{item.price}</span>
                </div>
                <div className="mt-4"><h3 className="font-bold text-meza-text leading-tight">{item.name}</h3></div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* RIGHT: CART / KITCHEN TAB */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col shadow-2xl z-20 transition-all duration-300 ${(isStartingShift || pinModal.isOpen) ? 'blur-md pointer-events-none' : ''}`}>
        
        {/* Panel Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            onClick={() => setRightPanelTab('order')} 
            className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'order' ? 'bg-white text-meza-text border-b-2 border-meza-primary' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Order
          </button>
          <button 
            onClick={() => setRightPanelTab('unpaid')} 
            className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'unpaid' ? 'bg-white text-meza-text border-b-2 border-meza-primary' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Unpaid {unpaidOrders.length > 0 && <span className="ml-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unpaidOrders.length}</span>}
          </button>
          <button 
            onClick={() => setRightPanelTab('kitchen')} 
            className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'kitchen' ? 'bg-white text-meza-text border-b-2 border-meza-primary' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Kitchen {kitchenOrders.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{kitchenOrders.length}</span>}
          </button>
        </div>

        {rightPanelTab === 'order' ? (
          <>
            <div className="h-10 flex items-center px-6 border-b border-gray-100 bg-[#fcf9f5] justify-between">
              <span className="font-bold text-gray-400 text-xs uppercase tracking-widest">Cart Items</span>
              <button onClick={() => requestManagerPin('void')} disabled={cart.length===0} className="text-[10px] uppercase font-bold text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded cursor-pointer disabled:opacity-50">Void Order</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item._id} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 pr-2"><h4 className="font-bold text-meza-text text-sm leading-tight line-clamp-2">{item.name}</h4><p className="text-xs text-gray-500 font-bold mt-1">₱{item.price.toFixed(2)}</p></div>
                    <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1 border border-gray-100 shrink-0">
                      <button onClick={() => updateCartItem(item._id, -1)} className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm border border-gray-200 active:scale-95 cursor-pointer text-meza-text font-bold text-lg">-</button>
                      <span className="w-5 text-center font-bold text-sm text-meza-text">{item.quantity}</span>
                      <button onClick={() => updateCartItem(item._id, 1)} className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm border border-gray-200 active:scale-95 cursor-pointer text-meza-text font-bold text-lg">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item._id)} className="ml-3 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <input type="text" placeholder="Add note..." value={item.note || ''} onChange={e => updateCartItem(item._id, 0, e.target.value)} className="w-full text-[10px] bg-gray-50 border border-gray-100 rounded px-2 py-1 outline-none focus:border-meza-primary text-gray-600 italic" />
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 bg-white p-5 space-y-3">
              <div className="flex justify-between text-sm font-medium text-gray-500"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-sm font-bold text-purple-600"><span>Discount</span><span>-₱{discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between items-end pt-1 border-t border-dashed border-gray-200 mt-2">
                <span className="text-gray-500 font-bold uppercase text-xs">Total</span>
                <span className="text-3xl font-black text-meza-text tracking-tight">₱{total.toFixed(2)}</span>
              </div>
              
              <button onClick={() => setIsCheckingOut(true)} disabled={cart.length === 0} className="w-full mt-4 bg-meza-primary hover:bg-meza-primary-hover text-white py-4 rounded-xl font-bold tracking-widest uppercase text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:transform-none flex items-center justify-center space-x-2 cursor-pointer">
                <span>Pay ₱{total.toFixed(2)}</span><span>→</span>
              </button>
            </div>
          </>
        ) : rightPanelTab === 'unpaid' ? (
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
            {unpaidOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">No unpaid table orders</div>
            ) : (
              unpaidOrders.map(o => (
                <div key={o._id} className="bg-white border-l-4 border-orange-500 rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <span className="font-black text-gray-800 text-lg mr-2">#{o._id.slice(-4).toUpperCase()}</span>
                      {o.tableNumber && <span className="bg-meza-text text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Table {o.tableNumber}</span>}
                    </div>
                    <span className="font-black text-meza-primary text-lg">₱{o.total.toFixed(2)}</span>
                  </div>
                  <ul className="space-y-1 mb-4">
                    {o.items.map((i, idx) => (
                      <li key={idx} className="flex justify-between text-xs text-gray-500 font-medium">
                        <span>{i.quantity}x {i.nameAtSale}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex space-x-2">
                    <button onClick={() => markAsPaid(o._id, 'cash')} className="flex-1 py-2 bg-green-50 text-green-700 border border-green-200 rounded font-bold text-xs hover:bg-green-100">Pay Cash</button>
                    <button onClick={() => markAsPaid(o._id, 'online')} className="flex-1 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded font-bold text-xs hover:bg-purple-100">Pay Online</button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
            {kitchenOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">No active kitchen orders</div>
            ) : (
              kitchenOrders.map(o => (
                <div key={o._id} className={`bg-white border-l-4 rounded-xl shadow-sm p-4 ${o.fulfillmentStatus === 'pending' ? 'border-orange-500' : o.fulfillmentStatus === 'preparing' ? 'border-blue-500' : 'border-green-500'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <span className="font-black text-gray-800 text-lg mr-2">#{o._id.slice(-4).toUpperCase()}</span>
                      {o.tableNumber && <span className="bg-meza-text text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Table {o.tableNumber}</span>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${o.fulfillmentStatus === 'pending' ? 'bg-orange-100 text-orange-700' : o.fulfillmentStatus === 'preparing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {o.fulfillmentStatus}
                    </span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {o.items.map((i, idx) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span className="font-bold text-gray-700">{i.quantity}x {i.nameAtSale}</span>
                        {i.note && <span className="text-xs text-red-500 italic block mt-0.5">Note: {i.note}</span>}
                      </li>
                    ))}
                  </ul>
                  {o.fulfillmentStatus === 'pending' && <button onClick={() => updateKitchenStatus(o._id, 'preparing')} className="w-full py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700">Start Preparing</button>}
                  {o.fulfillmentStatus === 'preparing' && <button onClick={() => updateKitchenStatus(o._id, 'ready')} className="w-full py-2 bg-green-600 text-white rounded font-bold text-sm hover:bg-green-700">Mark Ready</button>}
                  {o.fulfillmentStatus === 'ready' && <button onClick={() => updateKitchenStatus(o._id, 'served')} className="w-full py-2 bg-gray-800 text-white rounded font-bold text-sm hover:bg-gray-900">Mark Served</button>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {isCheckingOut && (
        <div className="fixed inset-0 bg-meza-text/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#fcf9f5]">
              <h3 className="font-bold text-meza-text uppercase tracking-wider text-sm">Complete Payment</h3>
              <button onClick={() => setIsCheckingOut(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-5xl font-black text-meza-text tracking-tight mt-1">₱{total.toFixed(2)}</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={() => setPaymentMethod('cash')} className={`py-4 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 transition-all cursor-pointer ${paymentMethod === 'cash' ? 'border-meza-primary bg-meza-primary/5 text-meza-primary' : 'border-gray-100 text-gray-500'}`}><Banknote className="w-6 h-6" /><span className="font-bold text-sm">Cash</span></button>
                <button onClick={() => setPaymentMethod('card')} className={`py-4 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 transition-all cursor-pointer ${paymentMethod === 'card' ? 'border-meza-primary bg-meza-primary/5 text-meza-primary' : 'border-gray-100 text-gray-500'}`}><CreditCard className="w-6 h-6" /><span className="font-bold text-sm">Card/GCash</span></button>
              </div>

              {paymentMethod === 'cash' && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                  <label className="text-xs font-bold text-gray-500 uppercase">Cash Tendered</label>
                  <input type="number" step="0.01" value={cashTendered} onChange={e=>setCashTendered(e.target.value)} className="w-full mt-2 text-2xl font-black text-meza-text bg-transparent outline-none border-b-2 border-gray-200 focus:border-meza-primary py-1" placeholder="0.00" />
                  <div className="flex justify-between mt-3 text-sm font-bold">
                    <span className="text-gray-500">Change Due:</span>
                    <span className={changeDue > 0 ? 'text-green-600' : 'text-gray-400'}>₱{changeDue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button onClick={processCheckout} disabled={paymentMethod === 'cash' && (parseFloat(cashTendered||0) < total)} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer">
                <Printer className="w-5 h-5" />
                <span>Confirm & Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
