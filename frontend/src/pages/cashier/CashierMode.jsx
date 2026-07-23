import { API_URL } from '../../config';
import { useState, useEffect } from 'react';
import { LogOut, CheckCircle, CreditCard, Banknote, Coffee, UtensilsCrossed, Croissant, Trash2, X, Play, SquareTerminal, WifiOff, Wifi, Printer, Search, Lock, UserCog, Pause, Bell, Percent } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPendingOrders, savePendingOrder, deletePendingOrder } from '../../utils/idb';

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
  const [offlineOrders, setOfflineOrders] = useState([]);
  const [isPendingSyncModalOpen, setIsPendingSyncModalOpen] = useState(false);
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
  const [managersList, setManagersList] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // New Feature States
  const [modifierModal, setModifierModal] = useState({ isOpen: false, item: null, selectedModifiers: [] });
  const [splitPaymentModal, setSplitPaymentModal] = useState({ isOpen: false });
  const [customerName, setCustomerName] = useState('');
  const [splitPayments, setSplitPayments] = useState([]); // Array of { method, amount }
  const [printOrder, setPrintOrder] = useState(null);
  const [checkoutSuccessModal, setCheckoutSuccessModal] = useState(null);
  
  // Auditing States
  const [voidReasonModal, setVoidReasonModal] = useState({ isOpen: false, reason: 'Customer Changed Mind' });

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
    const newSocket = io(`${API_URL}`, {
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
    
    // Fetch managers for PIN auth dropdown
    fetch(`${API_URL}/api/auth/managers`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setManagersList(data);
        if (data.length > 0) setSelectedManagerId(data[0]._id);
      })
      .catch(console.error);

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
      const res = await fetch(`${API_URL}/api/shifts/${currentShift._id}/analytics`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setShiftAnalytics(data.analytics);
    } catch (e) { console.error("Analytics fetch error", e); }
  };

  const executeEndShift = async () => {
    if (!isOnline) {
      showToast("Cannot end shift while offline. Please connect to the internet first.", "error");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/shifts/current`, { headers: { 'Authorization': `Bearer ${token}` } });
      const shift = await res.json();
      if (shift && shift._id) {
        localStorage.setItem('meza_cached_shift', JSON.stringify(shift));
        await fetch(`${API_URL}/api/shifts/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ actualCash: parseFloat(actualCashInput) })
        });
        logout();
        navigate('/login');
      }
    } catch (err) { alert('Error closing shift'); }
  };

  const fetchShift = async () => {
    try {
      const res = await fetch(`${API_URL}/api/shifts/current`, { headers: { 'Authorization': `Bearer ${token}` } });
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
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_URL}/api/menu`, { headers: { 'Authorization': `Bearer ${token}` } });
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
        const res = await fetch(`${API_URL}/api/orders/kds/active`, { headers: { 'Authorization': `Bearer ${token}` } });
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
      const res = await fetch(`${API_URL}/api/orders/unpaid`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setUnpaidOrders(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Unpaid orders fetch error", e); }
  };

  const markAsPaid = async (orderId, method) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ paymentMethod: method })
      });
      if (res.ok) fetchUnpaidOrders();
    } catch (e) { console.error(e); }
  };

  const updateKitchenStatus = async (orderId, newStatus) => {
    try {
      await fetch(`${API_URL}/api/orders/${orderId}/kds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ fulfillmentStatus: newStatus })
      });
    } catch (e) { console.error(e); }
  };

  // --- INDEXEDDB OFFLINE LOGIC ---

  const checkPendingCount = async () => {
    const orders = await getPendingOrders();
    const pending = orders.filter(o => o.syncStatus !== 'failed');
    const failed = orders.filter(o => o.syncStatus === 'failed');
    setPendingOrdersCount(pending.length);
    setFailedOrdersCount(failed.length);
    setOfflineOrders(orders);
  };

  const saveOrderOffline = async (orderPayload) => {
    await savePendingOrder({ ...orderPayload, syncStatus: 'pending', retryCount: 0, fulfillmentStatus: 'pending' });
    checkPendingCount();
    syncChannel.postMessage({ type: 'NEW_OFFLINE_ORDER' });
  };

  const flushPendingOrders = async () => {
    if (!navigator.onLine) return;

    try {
      await fetch(`${API_URL}/api/menu`, { method: 'HEAD', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (e) {
      return;
    }

    const orders = await getPendingOrders();
    const pendingToSync = orders.filter(o => o.syncStatus !== 'failed');

    for (let order of pendingToSync) {
      try {
        const res = await fetch(`${API_URL}/api/orders`, {
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
    const printableOrder = { ...order, total: total, cart: cart };
    setPrintOrder(printableOrder);
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
    if (tabName === null) return;
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
      await fetch(`${API_URL}/api/menu/${id}/toggle-availability`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
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

    const localUUID = crypto.randomUUID();

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

    await saveOrderOffline(orderPayload);

    setCart([]);
    setIsCheckingOut(false);
    setCashTendered('');

    flushPendingOrders();

    setCheckoutSuccessModal(printableOrder);
  };

  // --- SECURITY / PIN VERIFICATION ---
  const requestManagerPin = (action, payload) => {
    setPinModal({ isOpen: true, action, payload });
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ managerId: selectedManagerId, pin: pinInput })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (pinModal.action === 'void') {
          setVoidReasonModal({ isOpen: true, reason: 'Customer Changed Mind' });
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

  const submitVoidAudit = async () => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    try {
      await fetch(`${API_URL}/api/orders/audit-void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason: voidReasonModal.reason, cartTotal: total, items: cart })
      });
    } catch (err) {
      console.error('Failed to log void audit', err);
    }
    setCart([]);
    setDiscountAmount(0);
    setCustomerName('');
    showToast('Order voided and logged.', 'info');
    setVoidReasonModal({ isOpen: false, reason: 'Customer Changed Mind' });
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

    const modifiersHash = modifiers.map(m => m.name).sort().join(',');
    const cartItemId = `${item._id}_${modifiersHash}`;

    const existing = cart.find(c => c.cartItemId === cartItemId);
    const totalItemQty = cart.filter(c => c._id === item._id).reduce((sum, c) => sum + c.quantity, 0);

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
        
        if (delta > 0 && item.calculatedStock !== null && item.calculatedStock !== undefined) {
          const totalItemQty = cart.filter(c => c._id === item._id).reduce((sum, c) => sum + c.quantity, 0);
          if (totalItemQty >= item.calculatedStock) {
            showToast(`Cannot add more. Only ${item.calculatedStock} in stock!`, 'warning');
            return item;
          }
        }

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
      const res = await fetch(`${API_URL}/api/shifts/start`, {
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
      <div className="flex h-screen bg-[var(--color-meza-bg)] font-sans antialiased relative overflow-hidden print:hidden">

        {/* Click Effects */}
        {clickEffects.map(ce => (
          <div key={ce.id} className="absolute text-[var(--color-meza-primary)] font-bold text-2xl pointer-events-none drop- animate-ping" style={{ left: ce.x - 10, top: ce.y - 20, zIndex: 9999, animationDuration: '0.6s' }}>+1</div>
        ))}

        {/* Toasts */}
        <div className="absolute top-20 right-6 z-[9999] flex flex-col space-y-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-sm-sm  flex items-center space-x-3 transform transition-all ${t.type === 'success' ? 'bg-[var(--color-success)] text-white' : 'bg-gray-900 text-white'}`}>
              {t.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              <span className="font-bold text-sm tracking-wide">{t.message}</span>
            </div>
          ))}
        </div>

        {/* SHIFT GATES */}
        {isStartingShift && (
          <div className="absolute inset-0 bg-meza-text/60 backdrop-blur-sm z-[100] flex items-center justify-center">
            <form onSubmit={handleStartShift} className="bg-[var(--color-meza-surface)] p-8 rounded-sm-sm w-full max-w-sm  border border-[var(--color-meza-border)]">
              <div className="w-12 h-12 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-sm-full flex items-center justify-center mb-4"><Play className="w-6 h-6" /></div>
              <h2 className="text-2xl font-display font-bold text-[var(--color-meza-text)] mb-1">Start Shift</h2>
              <p className="text-sm text-[var(--color-meza-muted)] mb-6">Enter starting cash float.</p>
              <input type="number" step="0.01" min="0" required value={startingCashInput} onChange={e => setStartingCashInput(e.target.value)} className="w-full px-4 py-3 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm-sm mb-6 font-bold" placeholder="₱0.00" />
              <button type="submit" className="w-full py-3 bg-[var(--color-meza-primary)] text-white rounded-sm-sm font-bold">Open Register</button>
            </form>
          </div>
        )}

        {/* END SHIFT MODAL */}
        {isEndingShift && currentShift && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-meza-surface)] w-full max-w-lg shadow-2xl p-6">
              <h2 className="text-2xl font-display font-bold text-[var(--color-meza-text)] mb-4">End Shift Review</h2>
              <div className="space-y-4 mb-6">
                <div className="bg-[var(--color-meza-background)] p-4 rounded-sm flex justify-between items-center">
                  <span className="text-[var(--color-meza-text-muted)] font-bold text-sm uppercase tracking-wider">Total Orders</span>
                  <span className="text-xl font-bold text-[var(--color-meza-primary)]">{shiftAnalytics?.totalOrders || 0}</span>
                </div>
                <div className="bg-[var(--color-meza-background)] p-4 rounded-sm flex justify-between items-center">
                  <span className="text-[var(--color-meza-text-muted)] font-bold text-sm uppercase tracking-wider">Cash Total</span>
                  <span className="text-xl font-bold text-[var(--color-meza-text)]">₱{(shiftAnalytics?.cashTotal || 0).toFixed(2)}</span>
                </div>
              </div>
              
              {!isOnline && (pendingOrdersCount > 0 || failedOrdersCount > 0) && (
                 <div className="bg-[var(--color-danger)]/10 text-[var(--color-danger)] p-4 rounded-sm mb-6 text-sm font-bold flex items-center gap-2">
                   <AlertCircle className="w-5 h-5 flex-shrink-0" />
                   <span>You cannot end your shift while offline with pending orders. Please connect to the internet to sync {pendingOrdersCount + failedOrdersCount} orders.</span>
                 </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setIsEndingShift(false)} className="flex-1 py-4 border border-[var(--color-meza-border)] text-[var(--color-meza-text)] font-bold uppercase tracking-widest hover:bg-[var(--color-meza-background)] transition-colors">Cancel</button>
                <button 
                  onClick={executeEndShift} 
                  disabled={!isOnline && (pendingOrdersCount > 0 || failedOrdersCount > 0)}
                  className="flex-1 py-4 bg-[var(--color-danger)] text-white font-bold uppercase tracking-widest hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Confirm End Shift
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PENDING SYNC MODAL */}
        {isPendingSyncModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-meza-surface)] w-full max-w-2xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-display font-bold text-[var(--color-meza-text)]">Offline Queue</h2>
                <button onClick={() => setIsPendingSyncModalOpen(false)} className="text-[var(--color-meza-text-muted)] hover:text-[var(--color-meza-text)]">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-6 space-y-3 pr-2">
                {offlineOrders.length === 0 ? (
                  <div className="text-center py-10 text-[var(--color-meza-text-muted)] flex flex-col items-center">
                    <CheckCircle2 className="w-12 h-12 mb-2 text-green-500 opacity-50" />
                    <span className="font-bold">All orders are synced!</span>
                  </div>
                ) : (
                  offlineOrders.map(order => (
                    <div key={order.localUUID} className="bg-[var(--color-meza-background)] p-4 rounded-sm border border-[var(--color-meza-border)] flex justify-between items-center">
                      <div>
                        <div className="font-bold text-[var(--color-meza-text)]">Order #{order.localUUID.split('-')[0].toUpperCase()}</div>
                        <div className="text-xs text-[var(--color-meza-text-muted)] mt-1">
                          {order.items.length} items • ₱{(order.clientCalculatedTotal || 0).toFixed(2)} • {format(new Date(order.createdAtLocal), 'h:mm a')}
                        </div>
                        {order.syncStatus === 'failed' && (
                          <div className="text-xs text-[var(--color-danger)] font-bold mt-1 max-w-sm truncate">
                            Error: {order.syncError || 'Rejected by server'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {order.syncStatus === 'failed' ? (
                          <span className="px-2 py-1 bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[10px] font-bold uppercase rounded-sm">Failed</span>
                        ) : (
                          <span className="px-2 py-1 bg-[var(--color-warning)] text-white text-[10px] font-bold uppercase rounded-sm">Pending</span>
                        )}
                        {order.retryCount > 0 && <span className="text-[10px] text-[var(--color-meza-text-muted)]">Retries: {order.retryCount}/5</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-4 mt-auto">
                {failedOrdersCount > 0 && (
                  <button 
                    onClick={() => {
                      clearFailedOrders();
                      setIsPendingSyncModalOpen(false);
                    }} 
                    className="px-6 py-3 border border-[var(--color-danger)] text-[var(--color-danger)] font-bold uppercase tracking-widest hover:bg-[var(--color-danger)]/10 transition-colors text-sm"
                  >
                    Discard Failed
                  </button>
                )}
                <div className="flex-1"></div>
                <button 
                  onClick={flushPendingOrders} 
                  disabled={!isOnline || offlineOrders.length === 0}
                  className="px-6 py-3 bg-[var(--color-meza-primary)] text-white font-bold uppercase tracking-widest hover:bg-[var(--color-meza-primary)]/90 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isOnline && offlineOrders.length > 0 ? 'animate-spin' : ''}`} />
                  Force Sync All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODIFIER MODAL */}
        {modifierModal.isOpen && modifierModal.item && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[var(--color-meza-surface)] rounded-sm-sm w-full max-w-lg overflow-hidden  flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 p-4 text-white text-center">
                <h3 className="font-bold text-xl tracking-wider uppercase">Customize {modifierModal.item.name}</h3>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                {(modifierModal.item.modifierGroups || []).map((group, gIdx) => (
                  <div key={gIdx} className="mb-6 last:mb-0">
                    <h4 className="font-bold text-[var(--color-meza-text)] uppercase tracking-widest text-sm mb-3 border-b pb-2">{group.name} {group.multiSelect ? '(Choose multiple)' : '(Choose one)'}</h4>
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
                            className={`flex justify-between items-center p-3 rounded-sm-sm border-2 cursor-pointer transition-all ${isSelected ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/10' : 'border-[var(--color-meza-border)] hover:border-[var(--color-meza-primary)]/50'}`}
                          >
                            <span className="font-bold text-[var(--color-meza-text)]">{opt.name}</span>
                            <span className="font-bold text-[var(--color-meza-muted)]">{opt.price > 0 ? `+₱${opt.price}` : 'Free'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-[var(--color-meza-bg)] border-t grid grid-cols-2 gap-3">
                <button onClick={() => setModifierModal({ isOpen: false, item: null, selectedModifiers: [] })} className="py-3 font-bold text-[var(--color-meza-muted)] bg-[var(--color-meza-border)] rounded-sm-sm uppercase tracking-wider">Cancel</button>
                <button
                  onClick={() => {
                    addToCart(modifierModal.item, modifierModal.selectedModifiers);
                    setModifierModal({ isOpen: false, item: null, selectedModifiers: [] });
                  }}
                  className="py-3 font-bold text-white bg-[var(--color-meza-primary)] rounded-sm-sm uppercase tracking-wider "
                >Add to Cart</button>
              </div>
            </div>
          </div>
        )}

        {/* PIN MODAL */}
        {pinModal.isOpen && (
          <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <form onSubmit={handlePinSubmit} className="bg-[var(--color-meza-surface)] p-8 rounded-sm-sm w-full max-w-sm  border border-[var(--color-meza-border)] text-center">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-sm-full flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-[var(--color-meza-text)] mb-2">Manager PIN Required</h2>
              <p className="text-sm text-[var(--color-meza-muted)] mb-4">Authorize this action.</p>
              
              <div className="text-left mb-4">
                <label className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest ml-1 mb-1 block">Authorizing Manager</label>
                <select 
                  value={selectedManagerId} 
                  onChange={e => setSelectedManagerId(e.target.value)}
                  className="w-full bg-[var(--color-meza-bg)] border-2 border-[var(--color-meza-border)] rounded-sm-sm px-4 py-3 outline-none focus:border-[var(--color-meza-primary)] font-bold transition-colors appearance-none"
                  required
                >
                  <option value="" disabled>Select Manager</option>
                  {managersList.map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <input type="password" required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-widest text-2xl px-4 py-3 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm-sm mb-6 font-bold" placeholder="••••" maxLength={4} />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setPinModal({ isOpen: false })} className="flex-1 py-3 text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm-sm font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-sm-sm font-bold">Verify</button>
              </div>
            </form>
          </div>
        )}

        {/* CHECKOUT SUCCESS MODAL */}
        {checkoutSuccessModal && (
          <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-[var(--color-meza-surface)] p-8 rounded-sm-sm w-full max-w-sm  border border-[var(--color-meza-border)] text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-sm-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-meza-text)] mb-2">Payment Successful!</h2>
              <p className="text-sm text-[var(--color-meza-muted)] mb-6">Order #{checkoutSuccessModal.localUUID.slice(-4).toUpperCase()} has been saved.</p>
              
              <div className="flex flex-col space-y-3">
                <button onClick={() => { 
                  setPrintOrder(checkoutSuccessModal); 
                  setTimeout(() => window.print(), 100);
                  setCheckoutSuccessModal(null); 
                }} className="w-full py-4 bg-[var(--color-meza-primary)] hover:bg-[var(--color-meza-primary)]-hover text-white rounded-sm-sm font-bold tracking-widest uppercase text-sm  transition-all flex items-center justify-center space-x-2">
                  <Printer className="w-5 h-5" />
                  <span>Print Receipt</span>
                </button>
                <button onClick={() => setCheckoutSuccessModal(null)} className="w-full py-4 bg-[var(--color-meza-bg)] hover:bg-[var(--color-meza-border)] text-[var(--color-meza-muted)] rounded-sm-sm font-bold tracking-widest uppercase text-sm transition-all">
                  No Receipt Needed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Void Reason Modal */}
        {voidReasonModal.isOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in zoom-in duration-200">
            <div className="bg-[var(--color-meza-surface)] rounded-sm-lg p-6 w-96 shadow-2xl border border-[var(--color-danger)]/20">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[var(--color-meza-border)]">
                <div className="p-2 bg-[var(--color-danger)]/10 text-[var(--color-danger)] rounded-sm-md">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-meza-text)] tracking-tight">Void Reason</h3>
                  <p className="text-xs text-[var(--color-meza-muted)]">Please select why this order is being voided.</p>
                </div>
              </div>

              <div className="space-y-4">
                <select 
                  value={voidReasonModal.reason} 
                  onChange={e => setVoidReasonModal({...voidReasonModal, reason: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--color-meza-bg)] border-2 border-[var(--color-meza-border)] rounded-sm-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-[var(--color-meza-text)]"
                >
                  <option value="Customer Changed Mind">Customer Changed Mind</option>
                  <option value="Wrong Entry / Mistake">Wrong Entry / Mistake</option>
                  <option value="Customer Walked Out">Customer Walked Out</option>
                  <option value="System Test">System Test</option>
                </select>

                <div className="flex space-x-3 pt-2">
                  <button type="button" onClick={() => setVoidReasonModal({ isOpen: false, reason: '' })} className="flex-1 py-3 text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm-sm font-bold">Cancel</button>
                  <button type="button" onClick={submitVoidAudit} className="flex-1 py-3 bg-[var(--color-danger)] text-white hover:bg-red-700 rounded-sm-sm font-bold tracking-wide">Confirm Void</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LEFT: POS GRID */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${(isStartingShift || pinModal.isOpen || checkoutSuccessModal) ? 'blur-md pointer-events-none' : ''}`}>

          {/* Header */}
          <header className="h-16 bg-[var(--color-meza-surface)] border-b border-[var(--color-meza-border)] px-6 flex justify-between items-center ">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-display font-bold text-[var(--color-meza-text)] hidden md:block">meza.</h1>

              {/* App Switcher */}
              <div className="flex bg-[var(--color-meza-bg)] p-1 rounded-sm-sm">
                <button className="px-4 py-1.5 rounded-sm-sm bg-[var(--color-meza-surface)]  text-sm font-bold text-[var(--color-meza-text)] tap-scale">Cashier</button>
                <button onClick={() => navigate('/table/Kiosk')} className="px-4 py-1.5 rounded-sm-sm text-sm font-bold text-[var(--color-meza-muted)] hover:text-[var(--color-meza-text)] tap-scale">Ordering</button>
                <button onClick={() => navigate('/kds')} className="px-4 py-1.5 rounded-sm-sm text-sm font-bold text-[var(--color-meza-muted)] hover:text-[var(--color-meza-text)] tap-scale">KDS</button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsPendingSyncModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-1 rounded-sm text-xs font-bold transition-colors ${
                  !isOnline || failedOrdersCount > 0 || pendingOrdersCount > 0 
                    ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20' 
                    : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                }`}
              >
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span>
                  {!isOnline ? 'OFFLINE' : 'ONLINE'}
                </span>
                {(pendingOrdersCount > 0 || failedOrdersCount > 0) && (
                  <span className="ml-2 bg-[var(--color-danger)] text-white px-2 py-0.5 rounded-sm">
                    {pendingOrdersCount + failedOrdersCount} Pending Syncs
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              <button onClick={() => setIsEndingShift(true)} className="flex items-center space-x-1 px-3 py-1.5 rounded-sm-sm border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[11px] font-bold uppercase"><SquareTerminal className="w-3.5 h-3.5" /><span>Close Register</span></button>
              <button onClick={() => setIsProfileOpen(true)} className="p-2 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] rounded-sm-sm cursor-pointer transition-colors"><UserCog className="w-5 h-5" /></button>
              <button onClick={() => navigate('/login')} className="p-2 text-[var(--color-meza-muted)] hover:text-[var(--color-danger)] rounded-sm-sm cursor-pointer transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          </header>

          {/* OFFLINE BANNER */}
          {!isOnline && (
            <div className="bg-[var(--color-warning)] text-[var(--color-meza-surface)] px-6 py-2 text-sm font-bold flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Connection Lost. You are in Offline Mode. It is safe to continue taking orders; they will sync automatically when the internet returns.</span>
            </div>
          )}

          {/* Top Action Bar (Search + Categories) */}
          <div className="bg-[var(--color-meza-surface)] border-b border-[var(--color-meza-border)] p-4 flex flex-col sm:flex-row sm:items-center gap-4  z-10">
            {/* Search */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-meza-muted)]" />
              <input id="pos-search" type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm-sm text-base font-semibold outline-none focus:border-[var(--color-meza-primary)] focus:ring-4 focus:ring-[var(--color-meza-primary)]/10 transition-all " />
            </div>

            {/* Categories (Horizontal Scroll) */}
            <div className="flex space-x-3 overflow-x-auto no-scrollbar w-full pb-1">
              {['All', ...new Set(menuItems.map(i => i.category))].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-3 rounded-sm-sm text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 border-2 ${activeCategory === cat ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] ' : 'border-transparent bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-border)]'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <main className="flex-1 overflow-y-auto p-6 bg-[var(--color-meza-bg)]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredMenu.map(item => {
                const isSoldOut = !item.isAvailable || item.calculatedStock === 0;
                return (
                  <div key={item._id} onClick={(e) => handleItemClick(item, e)} className={`relative bg-[var(--color-meza-surface)] rounded-sm-sm border border-[var(--color-meza-border)]  transition-all cursor-pointer flex flex-col overflow-hidden active:scale-95 group min-h-[180px] ${isSoldOut ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:-translate-y-1 hover:'}`}>

                    {/* Image Area */}
                    <div className="h-32 bg-[var(--color-meza-bg)] relative overflow-hidden shrink-0">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--color-meza-muted)]">
                          {item.category === 'Drinks' ? <Coffee className="w-10 h-10" /> : item.category === 'Food' ? <UtensilsCrossed className="w-10 h-10" /> : <Croissant className="w-10 h-10" />}
                        </div>
                      )}
                      
                      {/* Beautiful Stock Indicators */}
                      {isSoldOut ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="bg-[var(--color-danger)] text-white px-3 py-1 rounded-sm-sm text-xs font-bold uppercase tracking-widest  transform -rotate-6">Sold Out</span>
                        </div>
                      ) : (
                        item.calculatedStock !== null && item.calculatedStock !== undefined && (
                          <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-sm-sm  backdrop-blur-md ${item.calculatedStock <= 5 ? 'bg-[var(--color-danger)]/100/90 text-white' : 'bg-[var(--color-meza-surface)]/90 text-[var(--color-meza-text)] border border-[var(--color-meza-border)]/50'}`}>
                            {item.calculatedStock} left
                          </div>
                        )
                      )}
                    </div>

                    {/* Text Area */}
                    <div className="p-4 flex-1 flex flex-col justify-between bg-[var(--color-meza-surface)] z-10">
                      <h3 className="font-bold text-[var(--color-meza-text)] text-[15px] font-display leading-snug line-clamp-2">{item.name}</h3>
                      <span className="text-[var(--color-meza-primary)] font-bold text-base mt-2">₱{item.price.toFixed(2)}</span>
                    </div>

                    {/* Restock/86 Controls */}
                    {!isSoldOut && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAvailability(item._id); }}
                        className="absolute bottom-3 right-3 text-[10px] uppercase font-bold px-2 py-1 rounded-sm-md bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)] transition-colors opacity-0 group-hover:opacity-100"
                        title="Mark as Sold Out"
                      >
                        86
                      </button>
                    )}
                    {isSoldOut && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAvailability(item._id); }}
                        className="absolute bottom-3 right-3 text-[10px] uppercase font-bold px-2 py-1 rounded-sm-md bg-[var(--color-meza-surface)] text-[var(--color-success)] hover:bg-[var(--color-success)]/10  transition-colors z-20"
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
        <div className={`w-full md:w-80 lg:w-96 bg-[var(--color-meza-surface)] border-l border-[var(--color-meza-border)] flex flex-col  z-20 transition-all duration-300 ${(isStartingShift || pinModal.isOpen || checkoutSuccessModal) ? 'blur-md pointer-events-none' : ''}`}>

          {/* Panel Tabs */}
          <div className="flex border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
            <button
              onClick={() => setRightPanelTab('order')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'order' ? 'bg-[var(--color-meza-surface)] text-[var(--color-meza-text)] border-b-2 border-[var(--color-meza-primary)]' : 'text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)]'}`}
            >
              Order
            </button>
            <button
              onClick={() => setRightPanelTab('unpaid')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'unpaid' ? 'bg-[var(--color-meza-surface)] text-[var(--color-meza-text)] border-b-2 border-[var(--color-meza-primary)]' : 'text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)]'}`}
            >
              To Pay {unpaidOrders.length > 0 && <span className="ml-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm-full">{unpaidOrders.length}</span>}
            </button>
            <button
              onClick={() => setRightPanelTab('kitchen')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'kitchen' ? 'bg-[var(--color-meza-surface)] text-[var(--color-meza-text)] border-b-2 border-[var(--color-meza-primary)]' : 'text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)]'}`}
            >
              Kitchen {kitchenOrders.length > 0 && <span className="ml-1.5 bg-[var(--color-danger)]/100 text-white text-[10px] px-1.5 py-0.5 rounded-sm-full">{kitchenOrders.length}</span>}
            </button>
            <button
              onClick={() => setRightPanelTab('history')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'history' ? 'bg-[var(--color-meza-surface)] text-[var(--color-meza-text)] border-b-2 border-[var(--color-meza-primary)]' : 'text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)]'}`}
            >
              History
            </button>
            <button
              onClick={() => setRightPanelTab('held')}
              className={`flex-1 py-3 font-bold text-xs flex items-center justify-center uppercase tracking-wider transition-colors ${rightPanelTab === 'held' ? 'bg-[var(--color-meza-surface)] text-[var(--color-meza-text)] border-b-2 border-[var(--color-meza-primary)]' : 'text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)]'}`}
            >
              Held {heldOrders.length > 0 && <span className="ml-1.5 bg-[var(--color-meza-bg)]0 text-white text-[10px] px-1.5 py-0.5 rounded-sm-full">{heldOrders.length}</span>}
            </button>
          </div>

          {rightPanelTab === 'order' ? (
            <>
              <div className="h-10 flex items-center px-6 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-surface)] justify-between receipt-dashed">
                <span className={`font-mono text-xs uppercase tracking-widest transition-colors ${cartPulse ? 'text-[var(--color-meza-primary)]' : 'text-[var(--color-meza-muted)]'}`}>Cart Items</span>
                <div className="flex space-x-2">
                  <button onClick={holdCurrentOrder} disabled={cart.length === 0} className="text-[10px] uppercase font-bold text-[var(--color-meza-muted)] border border-[var(--color-meza-border)] hover:bg-[var(--color-meza-bg)] bg-[var(--color-meza-surface)] px-2 py-0.5 rounded-sm cursor-pointer flex items-center space-x-1 disabled:opacity-50"><Pause className="w-3 h-3" /><span>Hold</span></button>
                  <button onClick={() => requestManagerPin('void')} disabled={cart.length === 0} className="text-[10px] uppercase font-bold text-[var(--color-danger)] border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-2 py-0.5 rounded-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"><Trash2 className="w-3 h-3" /><span>Void</span></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(item => (
                  <div key={item.cartItemId} className="bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] p-3 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 pr-2">
                        <h4 className="font-bold text-[var(--color-meza-text)] text-sm leading-tight line-clamp-2">{item.name}</h4>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.modifiers.map((m, mIdx) => (
                              <span key={mIdx} className="bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] border border-[var(--color-meza-primary)]/20 px-1.5 py-0.5 rounded-sm text-[10px] font-bold leading-none uppercase tracking-wider">
                                + {m.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-[var(--color-meza-muted)] font-mono font-bold mt-1.5">₱{((item.price) + (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0)).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center space-x-2 bg-[var(--color-meza-bg)] p-1 border border-[var(--color-meza-border)] shrink-0">
                        <button onClick={() => updateCartItem(item.cartItemId, -1)} className="w-8 h-8 flex items-center justify-center bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] active:scale-95 cursor-pointer text-[var(--color-meza-text)] font-bold text-lg">-</button>
                        <span className="w-5 text-center font-mono font-bold text-sm text-[var(--color-meza-text)]">{item.quantity}</span>
                        <button onClick={() => updateCartItem(item.cartItemId, 1)} className="w-8 h-8 flex items-center justify-center bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] active:scale-95 cursor-pointer text-[var(--color-meza-text)] font-bold text-lg">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="ml-3 p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <input type="text" placeholder="Add note..." value={item.note || ''} onChange={e => updateCartItem(item.cartItemId, 0, e.target.value)} className="w-full text-[10px] bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm px-2 py-1 outline-none focus:border-[var(--color-meza-primary)] text-[var(--color-meza-muted)] italic" />
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--color-meza-border)] bg-[var(--color-meza-surface)] p-5 space-y-3">
                {/* Quick Discounts */}
                <div className="flex space-x-2 mb-2">
                  <button onClick={() => requestManagerPin('discount', subtotal * 0.20)} disabled={cart.length === 0} className="flex-1 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded-sm flex items-center justify-center space-x-1 disabled:opacity-50">
                    <Percent className="w-3 h-3" /><span>Senior 20%</span>
                  </button>
                  <button onClick={() => requestManagerPin('discount', subtotal * 0.10)} disabled={cart.length === 0} className="flex-1 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-sm flex items-center justify-center space-x-1 disabled:opacity-50">
                    <Percent className="w-3 h-3" /><span>Staff 10%</span>
                  </button>
                </div>

                <div className="flex justify-between text-sm font-medium text-[var(--color-meza-muted)] font-mono"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-sm font-bold text-purple-600 font-mono"><span>Discount</span><span>-₱{discountAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between items-end pt-1 border-t border-dashed border-[var(--color-meza-border)] mt-2">
                  <span className="text-[var(--color-meza-muted)] font-bold uppercase text-xs">Total</span>
                  <span className="text-3xl font-mono font-bold text-[var(--color-meza-text)] tracking-tight">₱{total.toFixed(2)}</span>
                </div>

                <button onClick={() => setIsCheckingOut(true)} disabled={cart.length === 0} className="w-full mt-4 bg-[var(--color-meza-primary)] hover:bg-[var(--color-meza-primary-hover)] text-[var(--color-meza-surface)] py-4 font-bold tracking-widest uppercase text-sm active:scale-95 transition-all disabled:opacity-50 disabled:transform-none flex items-center justify-center space-x-2 cursor-pointer border border-[var(--color-meza-text)]">
                  <span>Pay ₱{total.toFixed(2)}</span><span>→</span>
                </button>
              </div>
            </>
          ) : rightPanelTab === 'unpaid' ? (
            <div className="flex-1 overflow-y-auto bg-[var(--color-meza-bg)] p-4 space-y-4">
              {unpaidOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--color-meza-muted)] font-bold text-sm">No unpaid table orders</div>
              ) : (
                unpaidOrders.map(o => (
                  <div key={o._id} className="bg-[var(--color-meza-surface)] border-l-4 border-orange-500 rounded-sm-sm  p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="font-bold text-[var(--color-meza-text)] text-lg mr-2">#{o._id.slice(-4).toUpperCase()}</span>
                        {o.tableNumber && <span className="bg-meza-text text-white px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider">Table {o.tableNumber}</span>}
                      </div>
                      <span className="font-bold text-[var(--color-meza-primary)] text-lg">₱{o.total.toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 mb-4">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between text-xs text-[var(--color-meza-muted)] font-medium">
                          <span>{i.quantity}x {i.nameAtSale}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex space-x-2">
                      <button onClick={() => markAsPaid(o._id, 'cash')} className="flex-1 py-2 bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/30 rounded-sm font-bold text-xs hover:bg-[var(--color-success)]/20">Pay Cash</button>
                      <button onClick={() => markAsPaid(o._id, 'online')} className="flex-1 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-sm font-bold text-xs hover:bg-purple-100">Pay Online</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : rightPanelTab === 'kitchen' ? (
            <div className="flex-1 overflow-y-auto bg-[var(--color-meza-bg)] p-4 space-y-4">
              {kitchenOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--color-meza-muted)] font-bold text-sm">No active kitchen orders</div>
              ) : (
                kitchenOrders.map(o => (
                  <div key={o._id} className={`bg-[var(--color-meza-surface)] border-l-4 rounded-sm-sm  p-4 ${o.fulfillmentStatus === 'pending' ? 'border-orange-500' : o.fulfillmentStatus === 'preparing' ? 'border-blue-500' : 'border-green-500'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="font-bold text-[var(--color-meza-text)] text-lg mr-2">#{o._id.slice(-4).toUpperCase()}</span>
                        {o.tableNumber && <span className="bg-meza-text text-white px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider">Table {o.tableNumber}</span>}
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${o.fulfillmentStatus === 'pending' ? 'bg-orange-100 text-orange-700' : o.fulfillmentStatus === 'preparing' ? 'bg-blue-100 text-blue-700' : 'bg-[var(--color-success)]/20 text-[var(--color-success)]'}`}>
                        {o.fulfillmentStatus}
                      </span>
                    </div>
                    <ul className="space-y-2 mb-4">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between text-sm">
                          <span className="font-bold text-[var(--color-meza-text)]">{i.quantity}x {i.nameAtSale}</span>
                          {i.note && <span className="text-xs text-[var(--color-danger)] italic block mt-0.5">Note: {i.note}</span>}
                        </li>
                      ))}
                    </ul>
                    {o.fulfillmentStatus === 'pending' && <button onClick={() => updateKitchenStatus(o._id, 'preparing')} className="w-full py-2 bg-blue-600 text-white rounded-sm font-bold text-sm hover:bg-blue-700">Start Preparing</button>}
                    {o.fulfillmentStatus === 'preparing' && <button onClick={() => updateKitchenStatus(o._id, 'ready')} className="w-full py-2 bg-[var(--color-success)] text-white rounded-sm font-bold text-sm hover:bg-[var(--color-success)]">Mark Ready</button>}
                    {o.fulfillmentStatus === 'ready' && <button onClick={() => updateKitchenStatus(o._id, 'served')} className="w-full py-2 bg-gray-800 text-white rounded-sm font-bold text-sm hover:bg-gray-900">Mark Served</button>}
                  </div>
                ))
              )}
            </div>
          ) : rightPanelTab === 'history' ? (
            <div className="flex-1 overflow-y-auto bg-[var(--color-meza-bg)] p-4 space-y-4">
              <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="font-bold text-[var(--color-meza-text)] text-sm uppercase tracking-wider">Shift Transactions</h3>
                <span className="text-xs font-bold text-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/10 px-2 py-1 rounded-sm">₱{shiftAnalytics?.totalSales?.toFixed(2) || '0.00'}</span>
              </div>
              {!shiftAnalytics || !shiftAnalytics.orders || shiftAnalytics.orders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--color-meza-muted)] font-bold text-sm">No transactions yet</div>
              ) : (
                shiftAnalytics.orders.map(o => (
                  <div key={o._id} className="bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm-sm  p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--color-meza-text)] text-sm">#{o._id.slice(-4).toUpperCase()}</span>
                        {o.customerName && <span className="text-xs font-bold text-[var(--color-meza-muted)]">{o.customerName}</span>}
                      </div>
                      <span className="text-xs font-bold text-[var(--color-meza-muted)]">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <ul className="space-y-1 mb-3 border-b border-[var(--color-meza-border)] pb-3">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between text-xs text-[var(--color-meza-muted)]">
                          <span>{i.quantity}x {i.nameAtSale}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${o.paymentMethod === 'cash' ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-blue-100 text-blue-700'}`}>
                        {o.paymentMethod}
                      </span>
                      <span className="font-bold text-[var(--color-meza-text)] text-sm">₱{o.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : rightPanelTab === 'held' ? (
            <div className="flex-1 overflow-y-auto bg-[var(--color-meza-bg)] p-4 space-y-4">
              {heldOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--color-meza-muted)] font-bold text-sm">No held orders</div>
              ) : (
                heldOrders.map(h => (
                  <div key={h.id} className="bg-[var(--color-meza-surface)] border-l-4 border-gray-500 rounded-sm-sm  p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-[var(--color-meza-text)] text-sm">Held at {h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-bold text-[var(--color-meza-primary)] text-sm">₱{h.cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 mb-4 text-xs text-[var(--color-meza-muted)] font-medium">
                      {h.cart.map((i, idx) => (
                        <li key={idx} className="flex justify-between"><span>{i.quantity}x {i.name}</span></li>
                      ))}
                    </ul>
                    <button onClick={() => resumeHeldOrder(h)} className="w-full py-2 bg-meza-text text-white rounded-sm font-bold text-xs hover:bg-black">Resume Order</button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Checkout Modal */}
        {isCheckingOut && (
          <div className="fixed inset-0 bg-meza-text/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <div className="bg-[var(--color-meza-surface)] rounded-sm-sm w-full max-w-md  overflow-hidden border border-[var(--color-meza-border)]">
              <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
                <h3 className="font-bold text-[var(--color-meza-text)] uppercase tracking-wider text-sm">Complete Payment</h3>
                <button onClick={() => setIsCheckingOut(false)} className="p-1 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] rounded-sm cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-5xl font-mono font-bold text-[var(--color-meza-text)] tracking-tight mt-1">₱{total.toFixed(2)}</h2>
                </div>

                <div className="mb-4 bg-orange-50 p-3 rounded-sm-sm border border-orange-100">
                  <label className="text-xs font-bold text-orange-800 uppercase ml-1 mb-1.5 block tracking-wider">Customer Name <span className="text-[var(--color-danger)]">*</span></label>
                  <input type="text" placeholder="e.g. John Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} className={`w-full text-lg bg-[var(--color-meza-surface)] font-mono border-2 rounded-sm-sm px-4 py-3 outline-none focus:border-[var(--color-meza-primary)] focus:ring-4 focus:ring-[var(--color-meza-primary)]/10 font-bold transition-all ${!customerName.trim() ? 'border-orange-300 ' : 'border-[var(--color-meza-border)]'}`} />
                  {!customerName.trim() && <p className="text-[10px] text-orange-600 font-bold mt-1.5 ml-1">Required to identify the order</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button onClick={() => setPaymentMethod('cash')} className={`py-3 rounded-sm-sm flex flex-col items-center justify-center space-y-1 border-2 transition-all cursor-pointer ${paymentMethod === 'cash' ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/5 text-[var(--color-meza-primary)]' : 'border-[var(--color-meza-border)] text-[var(--color-meza-muted)]'}`}><Banknote className="w-5 h-5" /><span className="font-bold text-xs">Cash</span></button>
                  <button onClick={() => setPaymentMethod('card')} className={`py-3 rounded-sm-sm flex flex-col items-center justify-center space-y-1 border-2 transition-all cursor-pointer ${paymentMethod === 'card' ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/5 text-[var(--color-meza-primary)]' : 'border-[var(--color-meza-border)] text-[var(--color-meza-muted)]'}`}><CreditCard className="w-5 h-5" /><span className="font-bold text-xs">Digital</span></button>
                  <button onClick={() => setPaymentMethod('split')} className={`py-3 rounded-sm-sm flex flex-col items-center justify-center space-y-1 border-2 transition-all cursor-pointer ${paymentMethod === 'split' ? 'border-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/5 text-[var(--color-meza-primary)]' : 'border-[var(--color-meza-border)] text-[var(--color-meza-muted)]'}`}><span className="font-bold text-xs">Split</span></button>
                </div>

                {paymentMethod === 'cash' && (() => {
                  const nearest100 = Math.ceil(total / 100) * 100;
                  const nearest500 = Math.ceil(total / 500) * 500;
                  const nearest1000 = Math.ceil(total / 1000) * 1000;
                  const options = Array.from(new Set([nearest100, nearest500, nearest1000])).filter(v => v > total);

                  return (
                    <div className="bg-[var(--color-meza-bg)] p-4 rounded-sm-sm border border-[var(--color-meza-border)] mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-[var(--color-meza-muted)] uppercase">Cash Tendered</label>
                        <div className="flex space-x-1">
                          <button onClick={() => setCashTendered(total.toString())} className="px-2 py-1 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] text-[10px] font-bold text-[var(--color-meza-muted)] rounded-sm  hover:bg-[var(--color-meza-bg)]">Exact</button>
                          {options.map(opt => (
                            <button key={opt} onClick={() => setCashTendered(opt.toString())} className="px-2 py-1 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] text-[10px] font-bold text-[var(--color-meza-muted)] rounded-sm  hover:bg-[var(--color-meza-bg)]">₱{opt}</button>
                          ))}
                        </div>
                      </div>
                      <input autoFocus type="number" step="0.01" value={cashTendered} onChange={e => setCashTendered(e.target.value)} className="w-full mt-1 text-2xl font-bold text-[var(--color-meza-text)] bg-transparent outline-none border-b-2 border-[var(--color-meza-border)] focus:border-[var(--color-meza-primary)] py-1" placeholder="0.00" />
                      <div className="flex justify-between mt-3 text-sm font-bold">
                        <span className="text-[var(--color-meza-muted)]">Change Due:</span>
                        <span className={changeDue > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-meza-muted)]'}>₱{changeDue.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                {paymentMethod === 'split' && (
                  <div className="bg-[var(--color-meza-bg)] p-4 rounded-sm-sm border border-[var(--color-meza-border)] mb-6 space-y-3">
                    {['cash', 'gcash', 'card'].map(method => {
                      const currentAmt = splitPayments.find(p => p.method === method)?.amount || '';
                      return (
                        <div key={method} className="flex justify-between items-center text-sm border-b border-[var(--color-meza-border)] pb-2 last:border-0 last:pb-0">
                          <span className="font-bold text-[var(--color-meza-muted)] capitalize">{method}</span>
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
                            className="w-24 text-right font-bold text-lg bg-transparent outline-none focus:text-[var(--color-meza-primary)]"
                          />
                        </div>
                      );
                    })}
                    <div className="flex justify-between mt-3 text-sm font-bold border-t border-dashed border-[var(--color-meza-border)] pt-3">
                      <span className="text-[var(--color-meza-muted)]">Total Tendered:</span>
                      <span className={splitPayments.reduce((s, p) => s + (p.amount || 0), 0) >= total ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                        ₱{splitPayments.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={processCheckout}
                  disabled={!customerName.trim() || (paymentMethod === 'cash' && (parseFloat(cashTendered || 0) < total)) || (paymentMethod === 'split' && splitPayments.reduce((s, p) => s + (p.amount || 0), 0) < total)}
                  className="w-full bg-[var(--color-success)] hover:bg-[var(--color-success)] text-white py-4 rounded-sm-sm font-bold uppercase tracking-wider text-sm  transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
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
