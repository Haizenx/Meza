import re

with open('/Users/apple/Meza/backend/routes/shifts.js', 'r') as f:
    content = f.read()

old_logic = """    const cashOrders = await Order.find({ shiftId: shift._id, paymentMethod: { $regex: /^cash$/i } });
    const cashSales = cashOrders.reduce((sum, order) => sum + order.total, 0);"""

new_logic = """    const orders = await Order.find({ shiftId: shift._id, status: { $ne: 'voided' } });
    let cashSales = 0;
    orders.forEach(order => {
      const pm = (order.paymentMethod || '').toLowerCase();
      if (pm === 'cash') {
        cashSales += order.total;
      } else if (pm === 'split' && Array.isArray(order.splitPayments)) {
        order.splitPayments.forEach(p => {
          if ((p.method || '').toLowerCase() === 'cash') {
            cashSales += (p.amount || 0);
          }
        });
      }
    });"""

# There are two places this occurs in shifts.js
content = content.replace(old_logic, new_logic)

with open('/Users/apple/Meza/backend/routes/shifts.js', 'w') as f:
    f.write(content)
