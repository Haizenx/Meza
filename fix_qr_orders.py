import re

with open('/Users/apple/Meza/backend/routes/orders.js', 'r') as f:
    content = f.read()

old_qr_destruct = """router.post('/qr', async (req, res) => {
  try {
    const { items, paymentMethod, tableNumber, localUUID, clientCalculatedTotal } = req.body;"""

new_qr_destruct = """router.post('/qr', async (req, res) => {
  try {
    const { items, paymentMethod, tableNumber, localUUID, clientCalculatedTotal, isPaidOnline, paymentIntentId } = req.body;
    
    if (isPaidOnline && !paymentIntentId) {
      return res.status(400).json({ message: 'Missing payment verification token' });
    }"""

content = content.replace(old_qr_destruct, new_qr_destruct, 1)

old_qr_status = """    const order = new Order({
      localUUID,
      items: populatedItems,
      subtotal,
      total,
      paymentMethod,
      tableNumber,
      status: req.body.isPaidOnline ? 'completed' : 'unpaid',
      fulfillmentStatus: 'pending'
    });"""

new_qr_status = """    const order = new Order({
      localUUID,
      items: populatedItems,
      subtotal,
      total,
      paymentMethod,
      tableNumber,
      status: isPaidOnline && paymentIntentId ? 'completed' : 'unpaid',
      fulfillmentStatus: 'pending'
    });"""

content = content.replace(old_qr_status, new_qr_status, 1)

with open('/Users/apple/Meza/backend/routes/orders.js', 'w') as f:
    f.write(content)
