import re

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'r') as f:
    content = f.read()

old_socket = """    const newSocket = io(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`, {
      auth: { token }
    });

    newSocket.on('menu:updated', () => fetchMenu());"""

new_socket = """    const newSocket = io(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected/reconnected. Healing state...');
      fetchKitchenOrders();
      fetchUnpaidOrders();
    });

    newSocket.on('menu:updated', () => fetchMenu());"""

content = content.replace(old_socket, new_socket, 1)

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'w') as f:
    f.write(content)
