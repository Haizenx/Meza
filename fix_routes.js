const fs = require('fs');
const file = 'backend/routes/orders.js';
let content = fs.readFileSync(file, 'utf8');

// The blocks we need to move
const kdsBlock = `
// GET /api/orders/kds/active (Fetch active orders for KDS)
router.get('/kds/active', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ 
      status: 'completed', 
      fulfillmentStatus: { $in: ['pending', 'preparing', 'ready'] } 
    }).sort({ createdAt: 1 }); // Oldest first
    
    res.json(orders);
  } catch (err) {
    res.status(500).send('Server error');
  }
});
`;

const unpaidBlock = `
// GET /api/orders/unpaid
router.get('/unpaid', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ status: 'unpaid' }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).send('Server error');
  }
});
`;

// Remove them from current position
content = content.replace(kdsBlock.trim() + '\n', '');
content = content.replace(unpaidBlock.trim() + '\n', '');

// Insert them BEFORE router.get('/:id'
content = content.replace(
  "// GET /api/orders/:id",
  kdsBlock.trim() + '\n\n' + unpaidBlock.trim() + '\n\n// GET /api/orders/:id'
);

fs.writeFileSync(file, content);
