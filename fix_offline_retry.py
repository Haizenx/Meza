import re

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'r') as f:
    content = f.read()

# Add failedOrdersCount state
old_state = """  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState('order'); // 'order' | 'unpaid' | 'kitchen' | 'history' | 'held'"""

new_state = """  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [failedOrdersCount, setFailedOrdersCount] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState('order'); // 'order' | 'unpaid' | 'kitchen' | 'history' | 'held'"""

content = content.replace(old_state, new_state, 1)

# Update checkPendingCount
old_check = """  const checkPendingCount = async () => {
    const orders = await getPendingOrders();
    setPendingOrdersCount(orders.length);
  };"""

new_check = """  const checkPendingCount = async () => {
    const orders = await getPendingOrders();
    const pending = orders.filter(o => o.syncStatus !== 'failed');
    const failed = orders.filter(o => o.syncStatus === 'failed');
    setPendingOrdersCount(pending.length);
    setFailedOrdersCount(failed.length);
  };"""

content = content.replace(old_check, new_check, 1)

# Update flushPendingOrders
old_flush = """    const orders = await getPendingOrders();

    for (let order of orders) {
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
          // Still delete it if it's a 4xx error so it doesn't loop forever
          if (res.status >= 400 && res.status < 500) {
            await deletePendingOrder(order.localUUID);
          } else {
            order.retryCount += 1;
            await savePendingOrder(order);
          }
        }
      } catch (err) {
        // Network error during flush, increment retry
        order.retryCount += 1;
        await savePendingOrder(order);
      }
    }
    checkPendingCount();"""

new_flush = """    const orders = await getPendingOrders();
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
    checkPendingCount();"""

content = content.replace(old_flush, new_flush, 1)

# Add clearFailedOrders function
old_print = """  // --- PRINT LOGIC ---"""
new_print = """  const clearFailedOrders = async () => {
    if (window.confirm('Delete all permanently failed offline orders? These cannot be recovered.')) {
      const orders = await getPendingOrders();
      for (let o of orders) {
        if (o.syncStatus === 'failed') await deletePendingOrder(o.localUUID);
      }
      checkPendingCount();
    }
  };

  // --- PRINT LOGIC ---"""

content = content.replace(old_print, new_print, 1)

# Update UI Status Badge
old_badge = """              {/* Network / Sync Status */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg">
                {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                <span className="text-[10px] font-bold uppercase text-gray-500">{pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : 'Synced'}</span>
              </div>"""

new_badge = """              {/* Network / Sync Status */}
              <div 
                onClick={failedOrdersCount > 0 ? clearFailedOrders : undefined}
                className={`flex items-center space-x-2 px-3 py-1 border rounded-lg ${failedOrdersCount > 0 ? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100' : 'bg-gray-50 border-gray-200'}`}
                title={failedOrdersCount > 0 ? 'Click to clear failed syncs' : 'Network Status'}
              >
                {isOnline ? <Wifi className={`w-4 h-4 ${failedOrdersCount > 0 ? 'text-red-500' : 'text-green-500'}`} /> : <WifiOff className="w-4 h-4 text-red-500" />}
                <span className={`text-[10px] font-bold uppercase ${failedOrdersCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {failedOrdersCount > 0 ? `${failedOrdersCount} Failed` : pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : 'Synced'}
                </span>
              </div>"""

content = content.replace(old_badge, new_badge, 1)

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'w') as f:
    f.write(content)
