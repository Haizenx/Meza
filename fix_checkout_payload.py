import re

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'r') as f:
    content = f.read()

old_payload = """    const orderPayload = {
      localUUID,
      shiftId: currentShift?._id,
      items: cart.map(i => ({ menuItemId: i._id, nameAtSale: i.name, quantity: i.quantity, note: i.note || '', modifiers: i.modifiers || [] })),
      paymentMethod,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered: paymentMethod === 'cash' ? parseFloat(cashTendered || 0) : 0,
      customerName,
      createdAtLocal: new Date().toISOString()
    };"""

new_payload = """    const orderPayload = {
      localUUID,
      shiftId: currentShift?._id,
      items: cart.map(i => ({ menuItemId: i._id, nameAtSale: i.name, quantity: i.quantity, note: i.note || '', modifiers: i.modifiers || [] })),
      paymentMethod,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered: paymentMethod === 'cash' ? parseFloat(cashTendered || 0) : 0,
      customerName,
      clientCalculatedTotal: total,
      createdAtLocal: new Date().toISOString()
    };"""

content = content.replace(old_payload, new_payload, 1)

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'w') as f:
    f.write(content)
