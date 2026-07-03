import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, LogOut, CheckCircle, CreditCard, Banknote, Coffee, UtensilsCrossed, Croissant, Trash2, X, Play, SquareTerminal, WifiOff, Wifi, Printer, Search, Lock, UserCog, Pause, Bell, Percent } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { openDB } from 'idb';
import { getPendingOrders, savePendingOrder, deletePendingOrder, updatePendingOrder } from '../../utils/idb';

const syncChannel = new BroadcastChannel('meza-offline-sync');
import { io } from 'socket.io-client';
import ProfileModal from '../../components/ProfileModal';
import ReceiptPrinter from '../../components/ReceiptPrinter';

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
  const [failedOrdersCount, setFailedOrdersCount] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState('order'); // 'order' | 'unpaid' | 'kitchen' | 'history' | 'held'
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [unpaidOrders, setUnpaidOrders] = useState([]);
  const [shiftAnalytics, setShiftAnalytics] = useState(null);

  // Efficiency State
  const [heldOrders, setHeldOrders] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [clickEffects, setClickEffects] = useState([]);
  const [cartPulse, setCartPulse] = useState(false);

  // Security Modal State (Manager PIN)
  const [pinModal, setPinModal] = useState({ isOpen: false, action: null, payload: null });
  const [pinInput, setPinInput] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // New Feature States
  const [modifierModal, setModifierModal] = useState({ isOpen: false, item: null, selectedModifiers: [] });
  const [splitPaymentModal, setSplitPaymentModal] = useState({ isOpen: false });
  const [customerName, setCustomerName] = useState('');
  const [splitPayments, setSplitPayments] = useState([]); // Array of { method, amount }
  const [printOrder, setPrintOrder] = useState(null);
  const [checkoutSuccessModal, setCheckoutSuccessModal] = useState(null);

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

    newSocket.on('connect', () => {
      console.log('Socket connected/reconnected. Healing state...');
      fetchKitchenOrders();
      fetchUnpaidOrders();
    });

    newSocket.on('menu:updated', () => fetchMenu());
    newSocket.on('inventory:low_stock', (data) => {
      showToast(`Warning: ${data.name} is critically low!`, 'warning');
      fetchMenu();
    });

    newSocket.on('kds:new_order', () => { fetchKitchenOrders(); fetchUnpaidOrders(); });
    newSocket.on('kds:update_status', (order) => {
      fetchKitchenOrders();
      if (order.fulfillmentStatus === 'ready') {
        showToast(`Order #${order._id.slice(-4).toUpperCase()} is Ready!`, 'success');
      }
    });
    newSocket.on('order:updated', () => { fetchUnpaidOrders(); fetchShiftAnalytics(); });
    newSocket.on('shift:updated', () => fetchShiftAnalytics());

    setSocket(newSocket);

    // Initial fetches
    fetchShift();
    fetchMenu();
    fetchKitchenOrders();
    fetchUnpaidOrders();

    syncChannel.onmessage = (event) => {
      if (event.data.type === 'NEW_OFFLINE_ORDER' || event.data.type === 'SYNC_COMPLETE' || event.data.type === 'KDS_OFFLINE_UPDATE') {
        fetchKitchenOrders();
      }
    };

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (currentShift) fetchShiftAnalytics();
  }, [currentShift]);

  const fetchShiftAnalytics = async () => {
    if (!currentShift) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/shifts/${currentShift._id}/analytics`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setShiftAnalytics(data.analytics);
    } catch (e) { console.error("Analytics fetch error", e); }
  };

  const fetchShift = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/shifts/current`, { headers: { 'Authorization': `Bearer ${token}` } });
      const shift = await res.json();
      if (shift && shift._id) {
        localStorage.setItem('meza_cached_shift', JSON.stringify(shift));
        setCurrentShift(shift);
      } else {
        localStorage.removeItem('meza_cached_shift');
        setIsStartingShift(true);
      }
    } catch (e) { 
      console.error("Shift fetch error, falling back to cache", e); 
      const cached = localStorage.getItem('meza_cached_shift');
      if (cached) setCurrentShift(JSON.parse(cached));
      // If offline and no cache, we just leave currentShift as null, 
      // but they can't checkout anyway without a shift.
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      localStorage.setItem('meza_cached_menu', JSON.stringify(data));
      setMenuItems(data.filter(i => !i.isArchived));
    } catch (e) { 
      console.error("Menu fetch error, falling back to cache", e); 
      const cached = localStorage.getItem('meza_cached_menu');
      if (cached) setMenuItems(JSON.parse(cached).filter(i => !i.isArchived));
    }
  };

  const fetchKitchenOrders = async () => {
    try {
      let onlineOrders = [];
      if (navigator.onLine) {
        const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders/kds/active`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) onlineOrders = await res.json();
      }
      
      const offlineOrders = await getPendingOrders();
      const offlineMapped = offlineOrders.map(o => ({
        ...o,
        _id: o.localUUID,
        createdAt: o.createdAtLocal || new Date().toISOString(),
        isOffline: true
      })).filter(o => ['pending', 'preparing', 'ready'].includes(o.fulfillmentStatus));

      const merged = [...onlineOrders, ...offlineMapped].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      setKitchenOrders(merged);
    } catch (e) { 
      console.error("Kitchen fetch error", e); 
      const offlineOrders = await getPendingOrders();
      const offlineMapped = offlineOrders.map(o => ({
        ...o, _id: o.localUUID, createdAt: o.createdAtLocal || new Date().toISOString(), isOffline: true
      })).filter(o => ['pending', 'preparing', 'ready'].includes(o.fulfillmentStatus));
      setKitchenOrders(offlineMapped.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)));
    }
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

  const checkPendingCount = async () => {
    const orders = await getPendingOrders();
    const pending = orders.filter(o => o.syncStatus !== 'failed');
    const failed = orders.filter(o => o.syncStatus === 'failed');
    setPendingOrdersCount(pending.length);
    setFailedOrdersCount(failed.length);
  };

  const saveOrderOffline = async (orderPayload) => {
    await savePendingOrder({ ...orderPayload, syncStatus: 'pending', retryCount: 0, fulfillmentStatus: 'pending' });
    checkPendingCount();
    syncChannel.postMessage({ type: 'NEW_OFFLINE_ORDER' });
  };

  const flushPendingOrders = async () => {
    if (!navigator.onLine) return;

    // Check real connectivity
    try {
      await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu`, { method: 'HEAD', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (e) {
      return; // Truly offline
    }

    const orders = await getPendingOrders();
    const pendingToSync = orders.filter(o => o.syncStatus !== 'failed');

    for (let order of pendingToSync) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(order)
        });

        if (res.ok) {
          await deletePendingOrder(order.localUUID);
        } else {
          const errorText = await res.text();
          console.error(`Order ${order.localUUID} rejected by server:`, errorText);
          showToast(`Order failed to sync: ${errorText}`, 'error');
          
          if (res.status >= 400 && res.status < 500) {
            // Unrecoverable (e.g. price drift or validation error)
            order.syncStatus = 'failed';
            await savePendingOrder(order);
          } else {
            order.retryCount = (order.retryCount || 0) + 1;
            if (order.retryCount >= 5) order.syncStatus = 'failed';
            await savePendingOrder(order);
          }
        }
      } catch (err) {
        order.retryCount = (order.retryCount || 0) + 1;
        if (order.retryCount >= 5) order.syncStatus = 'failed';
        await savePendingOrder(order);
      }
    }
    checkPendingCount();
    syncChannel.postMessage({ type: 'SYNC_COMPLETE' });
  };

  const clearFailedOrders = async () => {
    if (window.confirm('Delete all permanently failed offline orders? These cannot be recovered.')) {
      const orders = await getPendingOrders();
      for (let o of orders) {
        if (o.syncStatus === 'failed') await deletePendingOrder(o.localUUID);
      }
      checkPendingCount();
    }
  };

  // --- PRINT LOGIC ---
  const printReceipt = (order) => {
    // Add full cart to order for correct pricing logic in printer
    const printableOrder = { ...order, total: total, cart: cart };
    setPrintOrder(printableOrder);
    // Wait for state to render, then trigger print
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // --- EFFICIENCY HELPERS ---
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const holdCurrentOrder = () => {
    if (cart.length === 0) return;
    const tabName = window.prompt('Enter a name for this tab:');
    if (tabName === null) return; // User cancelled
    setHeldOrders(prev => [...prev, { id: Date.now(), name: tabName || 'Guest', cart, discountAmount, time: new Date() }]);
    setCart([]);
    setDiscountAmount(0);
    showToast('Order placed on hold.', 'info');
  };

  const resumeHeldOrder = (held) => {
    setCart(held.cart);
    setDiscountAmount(held.discountAmount);
    setHeldOrders(prev => prev.filter(h => h.id !== held.id));
    setRightPanelTab('order');
  };

  const toggleAvailability = async (id) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/menu/${id}/toggle-availability`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // socket broadcast menu:updated will trigger fetchMenu()
    } catch (e) {
      console.error(e);
      showToast('Failed to update availability', 'error');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || isStartingShift || isEndingShift || pinModal.isOpen) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const sub = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tot = Math.max(0, sub - discountAmount);

        if (cart.length > 0 && !isCheckingOut) setIsCheckingOut(true);
        else if (isCheckingOut && paymentMethod === 'cash' && parseFloat(cashTendered || 0) >= tot) {
          processCheckout();
        }
      } else if (e.key === 'Escape') {
        if (isCheckingOut) setIsCheckingOut(false);
        else if (searchQuery) setSearchQuery('');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('pos-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckingOut, cashTendered, isStartingShift, isEndingShift, pinModal.isOpen, discountAmount, paymentMethod, searchQuery, currentShift]);

  // --- CHECKOUT LOGIC ---
  const processCheckout = async () => {
    if (!currentShift || !currentShift._id) {
      showToast('Cannot process order: No active shift found!', 'error');
      return;
    }

    // Generate idempotency key instantly
    const localUUID = crypto.randomUUID();

    // Note: total is computed strictly server-side. We send it just for fallback/reference if needed, but backend ignores it.
    const orderPayload = {
      localUUID,
      shiftId: currentShift?._id,
      items: cart.map(i => ({ menuItemId: i._id, nameAtSale: i.name, quantity: i.quantity, note: i.note || '', modifiers: i.modifiers || [] })),
      paymentMethod,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered: paymentMethod === 'cash' ? parseFloat(cashTendered || 0) : 0,
      customerName,
      clientCalculatedTotal: total,
      createdAtLocal: new Date().toISOString()
    };

    const printableOrder = { ...orderPayload, total, cart };

    // 1. Save to Offline DB immediately
    await saveOrderOffline(orderPayload);

    // 2. Clear Cart & Close Modal
    setCart([]);
    setIsCheckingOut(false);
    setCashTendered('');

    // 3. Attempt Sync immediately
    flushPendingOrders();

    // 4. Show success modal
    setCheckoutSuccessModal(printableOrder);
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
  const handleItemClick = (item, e) => {
    if (!item.isAvailable || item.calculatedStock === 0) return;
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setModifierModal({ isOpen: true, item, selectedModifiers: [] });
    } else {
      addToCart(item, [], e);
    }
  };

  const addToCart = (item, modifiers = [], e = null) => {
    if (!item.isAvailable || item.calculatedStock === 0) return;

    // Cart items are uniquely identified by item ID + sorted modifiers
    const modifiersHash = modifiers.map(m => m.name).sort().join(',');
    const cartItemId = `${item._id}_${modifiersHash}`;

    const existing = cart.find(c => c.cartItemId === cartItemId);
    const totalItemQty = cart.filter(c => c._id === item._id).reduce((sum, c) => sum + c.quantity, 0);

    // Smart Stock Validation
    if (item.calculatedStock !== null && item.calculatedStock !== undefined && totalItemQty >= item.calculatedStock) {
      showToast(`Cannot add more. Only ${item.calculatedStock} in stock!`, 'warning');
      return;
    }

    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const newEffect = { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top };
      setClickEffects(prev => [...prev, newEffect]);
      setTimeout(() => setClickEffects(prev => prev.filter(ce => ce.id !== newEffect.id)), 600);
    }

    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 300);

    if (existing) {
      setCart(cart.map(c => c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, cartItemId, quantity: 1, note: '', modifiers }]);
    }
  };

  const updateCartItem = (cartItemId, delta, note = undefined) => {
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ, note: note !== undefined ? note : item.note } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId) => setCart(cart.filter(item => item.cartItemId !== cartItemId));

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
        const newShift = await res.json();
        localStorage.setItem('meza_cached_shift', JSON.stringify(newShift));
        setCurrentShift(newShift);
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

  const subtotal = cart.reduce((sum, item) => {
    const itemModSum = (item.modifiers || []).reduce((mSum, m) => mSum + (m.price || 0), 0);
    return sum + ((item.price + itemModSum) * item.quantity);
  }, 0);
  const total = Math.max(0, subtotal - discountAmount);

  let changeDue = 0;
  if (paymentMethod === 'cash' && cashTendered >= total) {
    changeDue = Math.max(0, parseFloat(cashTendered) - total);
  } else if (paymentMethod === 'split') {
    const splitTotal = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    if (splitTotal >= total) changeDue = Math.max(0, splitTotal - total);
  }

  return (
    <>
      <div className="flex h-screen bg-[#f4f1eb] font-sans antialiased relative overflow-hidden print:hidden">

        {/* Click Effects */}
        {clickEffects.map(ce => (
          <div key={ce.id} className="absolute text-meza-primary font-black text-2xl pointer-events-none drop-shadow-md animate-ping" style={{ left: ce.x - 10, top: ce.y - 20, zIndex: 9999, animationDuration: '0.6s' }}>+1</div>
        ))}

        {/* Toasts */}
        <div className="absolute top-20 right-6 z-[9999] flex flex-col space-y-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 transform transition-all ${t.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'}`}>
              {t.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              <span className="font-bold text-sm tracking-wide">{t.message}</span>
            </div>
          ))}
        </div>

        {/* SHIFT GATES */}
        {isStartingShift && (
          <div className="absolute inset-0 bg-meza-text/60 backdrop-blur-sm z-[100] flex items-center justify-center">
            <form onSubmit={handleStartShift} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4"><Play className="w-6 h-6" /></div>
              <h2 className="text-2xl font-black text-meza-text mb-1">Start Shift</h2>
              <p className="text-sm text-gray-500 mb-6">Enter starting cash float.</p>
              <input type="number" step="0.01" min="0" required value={startingCashInput} onChange={e => setStartingCashInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="₱0.00" />
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
              <input type="number" step="0.01" min="0" required value={actualCashInput} onChange={e => setActualCashInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="₱0.00" />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setIsEndingShift(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">End Shift</button>
              </div>
            </form>
          </div>
        )}

        {/* MODIFIER MODAL */}
        {modifierModal.isOpen && modifierModal.item && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 p-4 text-white text-center">
                <h3 className="font-black text-xl tracking-wider uppercase">Customize {modifierModal.item.name}</h3>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                {(modifierModal.item.modifierGroups || []).map((group, gIdx) => (
                  <div key={gIdx} className="mb-6 last:mb-0">
                    <h4 className="font-bold text-gray-800 uppercase tracking-widest text-sm mb-3 border-b pb-2">{group.name} {group.multiSelect ? '(Choose multiple)' : '(Choose one)'}</h4>
                    <div className="space-y-2">
                      {group.options.map((opt, oIdx) => {
                        const isSelected = modifierModal.selectedModifiers.some(m => m.name === opt.name);
                        return (
                          <div
                            key={oIdx}
                            onClick={() => {
                              let newMods = [...modifierModal.selectedModifiers];
                              if (isSelected) {
                                newMods = newMods.filter(m => m.name !== opt.name);
                              } else {
                                if (!group.multiSelect) {
                                  const groupOptNames = group.options.map(o => o.name);
                                  newMods = newMods.filter(m => !groupOptNames.includes(m.name));
                                }
                                newMods.push(opt);
                              }
                              setModifierModal(prev => ({ ...prev, selectedModifiers: newMods }));
                            }}
                            className={`flex justify-between items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'border-meza-primary bg-meza-primary/10' : 'border-gray-200 hover:border-meza-primary/50'}`}
                          >
                            <span className="font-bold text-gray-800">{opt.name}</span>
                            <span className="font-bold text-gray-500">{opt.price > 0 ? `+₱${opt.price}` : 'Free'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-50 border-t grid grid-cols-2 gap-3">
                <button onClick={() => setModifierModal({ isOpen: false, item: null, selectedModifiers: [] })} className="py-3 font-bold text-gray-600 bg-gray-200 rounded-xl uppercase tracking-wider">Cancel</button>
                <button
                  onClick={() => {
                    addToCart(modifierModal.item, modifierModal.selectedModifiers);
                    setModifierModal({ isOpen: false, item: null, selectedModifiers: [] });
                  }}
                  className="py-3 font-bold text-white bg-meza-primary rounded-xl uppercase tracking-wider shadow-md"
                >Add to Cart</button>
              </div>
            </div>
          </div>
        )}

        {/* PIN MODAL */}
        {pinModal.isOpen && (
          <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <form onSubmit={handlePinSubmit} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 text-center">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6" /></div>
              <h2 className="text-xl font-black text-meza-text mb-2">Manager PIN Required</h2>
              <p className="text-sm text-gray-500 mb-6">Authorize this action.</p>
              <input type="password" required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-widest text-2xl px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="••••" maxLength={4} />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setPinModal({ isOpen: false })} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">Verify</button>
              </div>
            </form>
          </div>
        )}

        {/* CHECKOUT SUCCESS MODAL */}
        {checkoutSuccessModal && (
          <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-meza-text mb-2">Payment Successful!</h2>
              <p className="text-sm text-gray-500 mb-6">Order #{checkoutSuccessModal.localUUID.slice(-4).toUpperCase()} has been saved.</p>
              
              <div className="flex flex-col space-y-3">
                <button onClick={() => { 
                  setPrintOrder(checkoutSuccessModal); 
                  setTimeout(() => window.print(), 100);
                  setCheckoutSuccessModal(null); 
                }} className="w-full py-4 bg-meza-primary hover:bg-meza-primary-hover text-white rounded-xl font-bold tracking-widest uppercase text-sm shadow-md transition-all flex items-center justify-center space-x-2">
                  <Printer className="w-5 h-5" />
                  <span>Print Receipt</span>
                </button>
                <button onClick={() => setCheckoutSuccessModal(null)} className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold tracking-widest uppercase text-sm transition-all">
                  No Receipt Needed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEFT: POS GRID */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${(isStartingShift || pinModal.isOpen || checkoutSuccessModal) ? 'blur-md pointer-events-none' : ''}`}>

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
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              {/* Network / Sync Status */}
              <div 
                onClick={failedOrdersCount > 0 ? clearFailedOrders : undefined}
                className={`flex items-center space-x-2 px-3 py-1 border rounded-lg ${failedOrdersCount > 0 ? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100' : 'bg-gray-50 border-gray-200'}`}
                title={failedOrdersCount > 0 ? 'Click to clear failed syncs' : 'Network Status'}
              >
                {isOnline ? <Wifi className={`w-4 h-4 ${failedOrdersCount > 0 ? 'text-red-500' : 'text-green-500'}`} /> : <WifiOff className="w-4 h-4 text-red-500" />}
                <span className={`text-[10px] font-bold uppercase ${failedOrdersCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {failedOrdersCount > 0 ? `${failedOrdersCount} Failed` : pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : 'Synced'}
                </span>
              </div>

              <button onClick={() => setIsEndingShift(true)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[11px] font-bold uppercase"><SquareTerminal className="w-3.5 h-3.5" /><span>Close Register</span></button>
              <button onClick={() => setIsProfileOpen(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer transition-colors"><UserCog className="w-5 h-5" /></button>
              <button onClick={() => navigate('/login')} className="p-2 text-gray-400 hover:text-red-600 rounded-lg cursor-pointer transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          </header>

          {/* Top Action Bar (Search + Categories) */}
          <div className="bg-white border-b border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm z-10">
            {/* Search */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="pos-search" type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-base font-semibold outline-none focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 transition-all shadow-inner" />
            </div>

            {/* Categories (Horizontal Scroll) */}
            <div className="flex space-x-3 overflow-x-auto no-scrollbar w-full pb-1">
              {['All', ...new Set(menuItems.map(i => i.category))].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 border-2 ${activeCategory === cat ? 'border-meza-primary bg-meza-primary/10 text-meza-primary shadow-sm' : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <main className="flex-1 overflow-y-auto p-6 bg-[#f4f1eb]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredMenu.map(item => {
                const isSoldOut = !item.isAvailable || item.calculatedStock === 0;
                return (
                  <div key={item._id} onClick={(e) => handleItemClick(item, e)} className={`relative bg-white rounded-2xl border border-gray-100 shadow-sm transition-all cursor-pointer flex flex-col overflow-hidden active:scale-95 group min-h-[180px] ${isSoldOut ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-xl'}`}>

                    {/* Image Area */}
                    <div className="h-32 bg-gray-100 relative overflow-hidden shrink-0">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          {item.category === 'Drinks' ? <Coffee className="w-10 h-10" /> : item.category === 'Food' ? <UtensilsCrossed className="w-10 h-10" /> : <Croissant className="w-10 h-10" />}
                        </div>
                      )}
                      
                      {/* Beautiful Stock Indicators */}
                      {isSoldOut ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg transform -rotate-6">Sold Out</span>
                        </div>
                      ) : (
                        item.calculatedStock !== null && item.calculatedStock !== undefined && (
                          <div className={`absolute top-3 right-3 text-[10px] font-black px-2 py-1 rounded-lg shadow-md backdrop-blur-md ${item.calculatedStock <= 5 ? 'bg-red-500/90 text-white' : 'bg-white/90 text-gray-700 border border-gray-200/50'}`}>
                            {item.calculatedStock} left
                          </div>
                        )
                      )}
                    </div>

                    {/* Text Area */}
                    <div className="p-4 flex-1 flex flex-col justify-between bg-white z-10">
                      <h3 className="font-black text-meza-text text-[15px] leading-snug line-clamp-2">{item.name}</h3>
                      <span className="text-meza-primary font-black text-base mt-2">₱{item.price.toFixed(2)}</span>
                    </div>

                    {/* Restock/86 Controls */}
                    {!isSoldOut && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAvailability(item._id); }}
                        className="absolute bottom-3 right-3 text-[10px] uppercase font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Mark as Sold Out"
                      >
                        86
                      </button>
                    )}
                    {isSoldOut && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAvailability(item._id); }}
                        className="absolute bottom-3 right-3 text-[10px] uppercase font-bold px-2 py-1 rounded-md bg-white text-green-600 hover:bg-green-50 shadow-sm transition-colors z-20"
                      >
                        Restock
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </main>
        </div>

        {/* RIGHT: CART / KITCHEN TAB */}
        <div className={`w-full md:w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col shadow-2xl z-20 transition-all duration-300 ${(isStartingShift || pinModal.isOpen || checkoutSuccessModal) ? 'blur-md pointer-events-none' : ''}`}>

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
              To Pay {unpaidOrders.length > 0 && <span className="ml-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unpaidOrders.length}</span>}
            </button>
            <button
              onClick={() => setRightPanelTab('kitchen')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'kitchen' ? 'bg-white text-meza-text border-b-2 border-meza-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Kitchen {kitchenOrders.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{kitchenOrders.length}</span>}
            </button>
            <button
              onClick={() => setRightPanelTab('history')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'history' ? 'bg-white text-meza-text border-b-2 border-meza-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              History
            </button>
            <button
              onClick={() => setRightPanelTab('held')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'held' ? 'bg-white text-meza-text border-b-2 border-meza-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Held {heldOrders.length > 0 && <span className="ml-1.5 bg-gray-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{heldOrders.length}</span>}
            </button>
          </div>

          {rightPanelTab === 'order' ? (
            <>
              <div className="h-10 flex items-center px-6 border-b border-gray-100 bg-[#fcf9f5] justify-between">
                <span className={`font-bold text-xs uppercase tracking-widest transition-colors ${cartPulse ? 'text-meza-primary' : 'text-gray-400'}`}>Cart Items</span>
                <div className="flex space-x-2">
                  <button onClick={holdCurrentOrder} disabled={cart.length === 0} className="text-[10px] uppercase font-bold text-gray-500 border border-gray-200 hover:bg-gray-100 bg-white px-2 py-0.5 rounded cursor-pointer flex items-center space-x-1 disabled:opacity-50"><Pause className="w-3 h-3" /><span>Hold</span></button>
                  <button onClick={() => requestManagerPin('void')} disabled={cart.length === 0} className="text-[10px] uppercase font-bold text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 flex items-center space-x-1"><Trash2 className="w-3 h-3" /><span>Void</span></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.cartItemId} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 pr-2">
                        <h4 className="font-bold text-meza-text text-sm leading-tight line-clamp-2">{item.name}</h4>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.modifiers.map((m, mIdx) => (
                              <span key={mIdx} className="bg-meza-primary/10 text-meza-primary border border-meza-primary/20 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none uppercase tracking-wider">
                                + {m.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 font-bold mt-1.5">₱{((item.price) + (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0)).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1 border border-gray-100 shrink-0">
                        <button onClick={() => updateCartItem(item.cartItemId, -1)} className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm border border-gray-200 active:scale-95 cursor-pointer text-meza-text font-bold text-lg">-</button>
                        <span className="w-5 text-center font-bold text-sm text-meza-text">{item.quantity}</span>
                        <button onClick={() => updateCartItem(item.cartItemId, 1)} className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm border border-gray-200 active:scale-95 cursor-pointer text-meza-text font-bold text-lg">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="ml-3 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <input type="text" placeholder="Add note..." value={item.note || ''} onChange={e => updateCartItem(item.cartItemId, 0, e.target.value)} className="w-full text-[10px] bg-gray-50 border border-gray-100 rounded px-2 py-1 outline-none focus:border-meza-primary text-gray-600 italic" />
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 bg-white p-5 space-y-3">

                {/* Quick Discounts */}
                <div className="flex space-x-2 mb-2">
                  <button onClick={() => requestManagerPin('discount', subtotal * 0.20)} disabled={cart.length === 0} className="flex-1 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded flex items-center justify-center space-x-1 disabled:opacity-50">
                    <Percent className="w-3 h-3" /><span>Senior 20%</span>
                  </button>
                  <button onClick={() => requestManagerPin('discount', subtotal * 0.10)} disabled={cart.length === 0} className="flex-1 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded flex items-center justify-center space-x-1 disabled:opacity-50">
                    <Percent className="w-3 h-3" /><span>Staff 10%</span>
                  </button>
                </div>

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
          ) : rightPanelTab === 'kitchen' ? (
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
          ) : rightPanelTab === 'history' ? (
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
              <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="font-bold text-meza-text text-sm uppercase tracking-wider">Shift Transactions</h3>
                <span className="text-xs font-bold text-meza-primary bg-meza-primary/10 px-2 py-1 rounded">₱{shiftAnalytics?.totalSales?.toFixed(2) || '0.00'}</span>
              </div>
              {!shiftAnalytics || !shiftAnalytics.orders || shiftAnalytics.orders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">No transactions yet</div>
              ) : (
                shiftAnalytics.orders.map(o => (
                  <div key={o._id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-800 text-sm">#{o._id.slice(-4).toUpperCase()}</span>
                        {o.customerName && <span className="text-xs font-bold text-gray-500">{o.customerName}</span>}
                      </div>
                      <span className="text-xs font-bold text-gray-400">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <ul className="space-y-1 mb-3 border-b border-gray-100 pb-3">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between text-xs text-gray-600">
                          <span>{i.quantity}x {i.nameAtSale}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${o.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {o.paymentMethod}
                      </span>
                      <span className="font-black text-meza-text text-sm">₱{o.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : rightPanelTab === 'held' ? (
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
              {heldOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">No held orders</div>
              ) : (
                heldOrders.map(h => (
                  <div key={h.id} className="bg-white border-l-4 border-gray-500 rounded-xl shadow-sm p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-black text-gray-800 text-sm">Held at {h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-black text-meza-primary text-sm">₱{h.cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 mb-4 text-xs text-gray-500 font-medium">
                      {h.cart.map((i, idx) => (
                        <li key={idx} className="flex justify-between"><span>{i.quantity}x {i.name}</span></li>
                      ))}
                    </ul>
                    <button onClick={() => resumeHeldOrder(h)} className="w-full py-2 bg-meza-text text-white rounded font-bold text-xs hover:bg-black">Resume Order</button>
                  </div>
                ))
              )}
            </div>
          ) : null}
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

                <div className="mb-4 bg-orange-50 p-3 rounded-xl border border-orange-100">
                  <label className="text-xs font-black text-orange-800 uppercase ml-1 mb-1.5 block tracking-wider">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. John Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} className={`w-full text-lg bg-white border-2 rounded-xl px-4 py-3 outline-none focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 font-bold transition-all ${!customerName.trim() ? 'border-orange-300 shadow-inner' : 'border-gray-200'}`} />
                  {!customerName.trim() && <p className="text-[10px] text-orange-600 font-bold mt-1.5 ml-1">Required to identify the order</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button onClick={() => setPaymentMethod('cash')} className={`py-3 rounded-xl flex flex-col items-center justify-center space-y-1 border-2 transition-all cursor-pointer ${paymentMethod === 'cash' ? 'border-meza-primary bg-meza-primary/5 text-meza-primary' : 'border-gray-100 text-gray-500'}`}><Banknote className="w-5 h-5" /><span className="font-bold text-xs">Cash</span></button>
                  <button onClick={() => setPaymentMethod('card')} className={`py-3 rounded-xl flex flex-col items-center justify-center space-y-1 border-2 transition-all cursor-pointer ${paymentMethod === 'card' ? 'border-meza-primary bg-meza-primary/5 text-meza-primary' : 'border-gray-100 text-gray-500'}`}><CreditCard className="w-5 h-5" /><span className="font-bold text-xs">Digital</span></button>
                  <button onClick={() => setPaymentMethod('split')} className={`py-3 rounded-xl flex flex-col items-center justify-center space-y-1 border-2 transition-all cursor-pointer ${paymentMethod === 'split' ? 'border-meza-primary bg-meza-primary/5 text-meza-primary' : 'border-gray-100 text-gray-500'}`}><span className="font-bold text-xs">Split</span></button>
                </div>

                {paymentMethod === 'cash' && (() => {
                  const nearest100 = Math.ceil(total / 100) * 100;
                  const nearest500 = Math.ceil(total / 500) * 500;
                  const nearest1000 = Math.ceil(total / 1000) * 1000;
                  const options = Array.from(new Set([nearest100, nearest500, nearest1000])).filter(v => v > total);

                  return (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Cash Tendered</label>
                        <div className="flex space-x-1">
                          <button onClick={() => setCashTendered(total.toString())} className="px-2 py-1 bg-white border border-gray-200 text-[10px] font-bold text-gray-600 rounded shadow-sm hover:bg-gray-100">Exact</button>
                          {options.map(opt => (
                            <button key={opt} onClick={() => setCashTendered(opt.toString())} className="px-2 py-1 bg-white border border-gray-200 text-[10px] font-bold text-gray-600 rounded shadow-sm hover:bg-gray-100">₱{opt}</button>
                          ))}
                        </div>
                      </div>
                      <input autoFocus type="number" step="0.01" value={cashTendered} onChange={e => setCashTendered(e.target.value)} className="w-full mt-1 text-2xl font-black text-meza-text bg-transparent outline-none border-b-2 border-gray-200 focus:border-meza-primary py-1" placeholder="0.00" />
                      <div className="flex justify-between mt-3 text-sm font-bold">
                        <span className="text-gray-500">Change Due:</span>
                        <span className={changeDue > 0 ? 'text-green-600' : 'text-gray-400'}>₱{changeDue.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                {paymentMethod === 'split' && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 space-y-3">
                    {['cash', 'gcash', 'card'].map(method => {
                      const currentAmt = splitPayments.find(p => p.method === method)?.amount || '';
                      return (
                        <div key={method} className="flex justify-between items-center text-sm border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                          <span className="font-bold text-gray-600 capitalize">{method}</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={currentAmt}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setSplitPayments(prev => {
                                const filtered = prev.filter(p => p.method !== method);
                                return isNaN(val) ? filtered : [...filtered, { method, amount: val }];
                              });
                            }}
                            className="w-24 text-right font-bold text-lg bg-transparent outline-none focus:text-meza-primary"
                          />
                        </div>
                      );
                    })}
                    <div className="flex justify-between mt-3 text-sm font-bold border-t border-dashed border-gray-300 pt-3">
                      <span className="text-gray-500">Total Tendered:</span>
                      <span className={splitPayments.reduce((s, p) => s + (p.amount || 0), 0) >= total ? 'text-green-600' : 'text-red-500'}>
                        ₱{splitPayments.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={processCheckout}
                  disabled={!customerName.trim() || (paymentMethod === 'cash' && (parseFloat(cashTendered || 0) < total)) || (paymentMethod === 'split' && splitPayments.reduce((s, p) => s + (p.amount || 0), 0) < total)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                  <span>Confirm & Print</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </div>

      <ReceiptPrinter order={printOrder} />
    </>
  );
}
