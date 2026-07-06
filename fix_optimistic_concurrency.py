import re

with open('/Users/apple/Meza/backend/routes/menu.js', 'r') as f:
    content = f.read()

old_put = """router.put('/:id', authenticate, authorize('owner', 'manager'), validateZod(menuItemSchema), async (req, res) => {
  try {
    const { name, description, price, category, photoUrl, modifierGroups } = req.body;
    
    const existingItem = await MenuItem.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');"""

new_put = """router.put('/:id', authenticate, authorize('owner', 'manager'), validateZod(menuItemSchema), async (req, res) => {
  try {
    const { name, description, price, category, photoUrl, modifierGroups, __v } = req.body;
    
    const existingItem = await MenuItem.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');
    
    // Optimistic Concurrency Control
    if (__v !== undefined && existingItem.__v > __v) {
      return res.status(409).json({ message: 'Conflict: This item was modified by another user. Please refresh and try again.' });
    }"""

content = content.replace(old_put, new_put, 1)

with open('/Users/apple/Meza/backend/routes/menu.js', 'w') as f:
    f.write(content)

with open('/Users/apple/Meza/backend/routes/inventory.js', 'r') as f:
    content = f.read()

old_inv_put = """router.put('/:id', authenticate, authorize('owner', 'manager'), validateZod(ingredientSchema), async (req, res) => {
  try {
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold } = req.body;
    
    const existingItem = await Ingredient.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');"""

new_inv_put = """router.put('/:id', authenticate, authorize('owner', 'manager'), validateZod(ingredientSchema), async (req, res) => {
  try {
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold, __v } = req.body;
    
    const existingItem = await Ingredient.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');
    
    // Optimistic Concurrency Control
    if (__v !== undefined && existingItem.__v > __v) {
      return res.status(409).json({ message: 'Conflict: This item was modified by another user. Please refresh and try again.' });
    }"""

content = content.replace(old_inv_put, new_inv_put, 1)

with open('/Users/apple/Meza/backend/routes/inventory.js', 'w') as f:
    f.write(content)
