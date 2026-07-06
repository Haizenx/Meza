import re

with open('/Users/apple/Meza/backend/routes/orders.js', 'r') as f:
    content = f.read()

# For POST /api/orders
old_post_destruct = """router.post('/', authenticate, async (req, res) => {
  try {
    const { items, paymentMethod, splitPayments, cashTendered, customerName, localUUID, shiftId, fulfillmentStatus } = req.body;"""

new_post_destruct = """router.post('/', authenticate, async (req, res) => {
  try {
    const { items, paymentMethod, splitPayments, cashTendered, customerName, localUUID, shiftId, fulfillmentStatus, clientCalculatedTotal } = req.body;"""

content = content.replace(old_post_destruct, new_post_destruct, 1)

old_post_calc = """    const total = Math.max(0, subtotal - discountAmount);
    
    // 3. Deduct Ingredients using Recipe"""

new_post_calc = """    const total = Math.max(0, subtotal - discountAmount);
    
    if (clientCalculatedTotal !== undefined && Math.abs(clientCalculatedTotal - total) > 0.01) {
      const err = new Error(`Price mismatch: Server calculated ${total}, but client sent ${clientCalculatedTotal}. Please refresh your menu.`);
      err.status = 409;
      throw err;
    }
    
    // 3. Deduct Ingredients using Recipe"""

content = content.replace(old_post_calc, new_post_calc, 1)

# For POST /api/orders/qr
old_qr_destruct = """router.post('/qr', async (req, res) => {
  try {
    const { items, paymentMethod, tableNumber, localUUID } = req.body;"""

new_qr_destruct = """router.post('/qr', async (req, res) => {
  try {
    const { items, paymentMethod, tableNumber, localUUID, clientCalculatedTotal } = req.body;"""

content = content.replace(old_qr_destruct, new_qr_destruct, 1)

old_qr_calc = """    const total = subtotal; // Assuming no discounts for QR orders right now
    
    // 3. Deduct Ingredients using Recipe"""

new_qr_calc = """    const total = subtotal; // Assuming no discounts for QR orders right now
    
    if (clientCalculatedTotal !== undefined && Math.abs(clientCalculatedTotal - total) > 0.01) {
      const err = new Error(`Price mismatch: Server calculated ${total}, but client sent ${clientCalculatedTotal}. Please refresh your menu.`);
      err.status = 409;
      throw err;
    }
    
    // 3. Deduct Ingredients using Recipe"""

content = content.replace(old_qr_calc, new_qr_calc, 1)

old_post_error = """      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});"""

new_post_error = """      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ message: err.message });
    res.status(400).json({ message: err.message });
  }
});"""

content = content.replace(old_post_error, new_post_error, 2) # do it for both routes

with open('/Users/apple/Meza/backend/routes/orders.js', 'w') as f:
    f.write(content)
