import re

with open('/Users/apple/Meza/backend/routes/orders.js', 'r') as f:
    content = f.read()

# 1. Fix KDS Ledger Inflation
old_kds = """    order.fulfillmentStatus = fulfillmentStatus;
    await order.save();

    const transaction = new Transaction({
      orderId: order._id,
      type: 'sale',
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      cashTendered: order.cashTendered,
      changeDue: order.changeDue,
      cashierId: req.user.id
    });
    await transaction.save();"""

new_kds = """    order.fulfillmentStatus = fulfillmentStatus;
    await order.save();"""

content = content.replace(old_kds, new_kds)

# 2. Fix POST /api/orders
old_post = """    for (let item of items) {
      if (!item.menuItemId || item.quantity <= 0) {
        throw new Error('Invalid item data');
      }

      // 1. Fetch current price from DB (do NOT trust client price)
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);"""

new_post = """    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (let item of items) {
        if (!item.menuItemId || item.quantity <= 0) {
          throw new Error('Invalid item data');
        }

        // 1. Fetch current price from DB (do NOT trust client price)
        const menuItem = await MenuItem.findById(item.menuItemId).session(session);
        if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);"""

content = content.replace(old_post, new_post, 1)

old_post_inv_1 = """      // 2. Deduct Finished Goods Stock directly from MenuItem
      menuItem.stockQuantity = (menuItem.stockQuantity || 0) - item.quantity;
      await menuItem.save();"""

new_post_inv_1 = """      // 2. Deduct Finished Goods Stock directly from MenuItem
      await MenuItem.updateOne({ _id: menuItem._id }, { $inc: { stockQuantity: -item.quantity } }, { session });
      menuItem.stockQuantity = (menuItem.stockQuantity || 0) - item.quantity;"""

content = content.replace(old_post_inv_1, new_post_inv_1, 1)

old_post_inv_2 = """    // 4. Execute Atomic Raw Inventory Deductions
    for (let [ingId, amount] of inventoryDeductions.entries()) {
      const ingredient = await Ingredient.findById(ingId);
      if (ingredient) {
        ingredient.stockQuantity -= amount;
        await ingredient.save();"""

new_post_inv_2 = """    // 4. Execute Atomic Raw Inventory Deductions
    for (let [ingId, amount] of inventoryDeductions.entries()) {
      await Ingredient.updateOne({ _id: ingId }, { $inc: { stockQuantity: -amount } }, { session });
      const ingredient = await Ingredient.findById(ingId).session(session);
      if (ingredient) {"""

content = content.replace(old_post_inv_2, new_post_inv_2, 1)

old_post_save = """    const newOrder = new Order({
      localUUID,
      items: processedItems,
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered,
      changeDue,
      customerName,
      cashierId: req.user.id,
      shiftId: shiftId,
      status: 'completed',
      fulfillmentStatus: fulfillmentStatus || 'pending'
    });

    await newOrder.save();

    if (newOrder.status === 'completed') {
      const transaction = new Transaction({
        orderId: newOrder._id,
        type: 'sale',
        subtotal: newOrder.subtotal,
        discountAmount: newOrder.discountAmount,
        total: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        cashTendered: newOrder.cashTendered,
        changeDue: newOrder.changeDue,
        cashierId: newOrder.cashierId
      });
      await transaction.save();
    }

    // Broadcast new order to Dashboard and KDS
    if (req.io) {
      req.io.emit('order:created', newOrder);
      req.io.emit('shift:updated'); // Force ShiftHistory to recalculate live totals
      req.io.emit('kds:new_order', newOrder);
    }

    res.status(201).json(newOrder);"""

new_post_save = """    const newOrder = new Order({
      localUUID,
      items: processedItems,
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered,
      changeDue,
      customerName,
      cashierId: req.user.id,
      shiftId: shiftId,
      status: 'completed',
      fulfillmentStatus: fulfillmentStatus || 'pending'
    });

    await newOrder.save({ session });

    if (newOrder.status === 'completed') {
      const transaction = new Transaction({
        orderId: newOrder._id,
        type: 'sale',
        subtotal: newOrder.subtotal,
        discountAmount: newOrder.discountAmount,
        total: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        cashTendered: newOrder.cashTendered,
        changeDue: newOrder.changeDue,
        cashierId: newOrder.cashierId
      });
      await transaction.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Broadcast new order to Dashboard and KDS
    if (req.io) {
      req.io.emit('order:created', newOrder);
      req.io.emit('shift:updated'); // Force ShiftHistory to recalculate live totals
      req.io.emit('kds:new_order', newOrder);
    }

    res.status(201).json(newOrder);
    
    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }"""

content = content.replace(old_post_save, new_post_save, 1)

# Do the same for POST /api/orders/qr
# Note: qr route does not have order.save() with transaction because I can just replace the whole route if needed. 
# Let's apply similar string replace for qr.

old_qr_post = """    for (let item of items) {
      if (!item.menuItemId || item.quantity <= 0) {
        throw new Error('Invalid item data');
      }

      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);"""

new_qr_post = """    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (let item of items) {
        if (!item.menuItemId || item.quantity <= 0) {
          throw new Error('Invalid item data');
        }

        const menuItem = await MenuItem.findById(item.menuItemId).session(session);
        if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);"""

content = content.replace(old_qr_post, new_qr_post, 1)

old_qr_inv_1 = """      menuItem.stockQuantity = (menuItem.stockQuantity || 0) - item.quantity;
      await menuItem.save();"""

new_qr_inv_1 = """      await MenuItem.updateOne({ _id: menuItem._id }, { $inc: { stockQuantity: -item.quantity } }, { session });
      menuItem.stockQuantity = (menuItem.stockQuantity || 0) - item.quantity;"""

content = content.replace(old_qr_inv_1, new_qr_inv_1, 1)

old_qr_inv_2 = """    for (let [ingId, amount] of inventoryDeductions.entries()) {
      const ingredient = await Ingredient.findById(ingId);
      if (ingredient) {
        ingredient.stockQuantity -= amount;
        await ingredient.save();"""

new_qr_inv_2 = """    for (let [ingId, amount] of inventoryDeductions.entries()) {
      await Ingredient.updateOne({ _id: ingId }, { $inc: { stockQuantity: -amount } }, { session });
      const ingredient = await Ingredient.findById(ingId).session(session);
      if (ingredient) {"""

content = content.replace(old_qr_inv_2, new_qr_inv_2, 1)

old_qr_save = """    const newOrder = new Order({
      localUUID,
      items: processedItems,
      subtotal,
      total,
      paymentMethod: finalPaymentMethod,
      orderType: 'qr',
      tableNumber: tableNumber,
      status: status,
      fulfillmentStatus: 'pending'
    });

    await newOrder.save();

    if (req.io) {
      req.io.emit('order:created', newOrder);
      if (status === 'completed') {
        req.io.emit('kds:new_order', newOrder);
      } else {
        // Unpaid order, just notify cashier
        req.io.emit('order:updated', newOrder);
      }
    }

    res.status(201).json(newOrder);"""

new_qr_save = """    const newOrder = new Order({
      localUUID,
      items: processedItems,
      subtotal,
      total,
      paymentMethod: finalPaymentMethod,
      orderType: 'qr',
      tableNumber: tableNumber,
      status: status,
      fulfillmentStatus: 'pending'
    });

    await newOrder.save({ session });
    
    if (status === 'completed') {
      const transaction = new Transaction({
        orderId: newOrder._id,
        type: 'sale',
        subtotal: newOrder.subtotal,
        discountAmount: 0,
        total: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        cashTendered: newOrder.total,
        changeDue: 0
      });
      await transaction.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    if (req.io) {
      req.io.emit('order:created', newOrder);
      if (status === 'completed') {
        req.io.emit('kds:new_order', newOrder);
      } else {
        // Unpaid order, just notify cashier
        req.io.emit('order:updated', newOrder);
      }
    }

    res.status(201).json(newOrder);

    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }"""

content = content.replace(old_qr_save, new_qr_save, 1)

# 3. Fix PUT /api/orders/:id/pay
old_pay = """    order.status = 'completed';
    order.fulfillmentStatus = 'preparing';
    order.paymentMethod = paymentMethod || 'cash';
    order.cashierId = req.user.id; // Record who processed the payment
    
    await order.save();

    const transaction = new Transaction({
      orderId: order._id,
      type: 'sale',
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      cashTendered: order.cashTendered,
      changeDue: order.changeDue,
      cashierId: req.user.id
    });
    await transaction.save();

    if (req.io) {"""

new_pay = """    order.status = 'completed';
    order.fulfillmentStatus = 'preparing';
    order.paymentMethod = paymentMethod || 'cash';
    order.cashierId = req.user.id; // Record who processed the payment
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await order.save({ session });

      const transaction = new Transaction({
        orderId: order._id,
        type: 'sale',
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        cashTendered: order.cashTendered,
        changeDue: order.changeDue,
        cashierId: req.user.id
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }

    if (req.io) {"""

content = content.replace(old_pay, new_pay, 1)

# 4. Fix PUT /api/orders/:id/void
old_void = """    order.status = 'voided';
    order.voidedBy = authorizedManager._id;
    order.voidReason = voidReason;
    
    await order.save();

    // Create a void transaction
    const originalTx = await Transaction.findOne({ orderId: order._id, type: 'sale' });
    
    const transaction = new Transaction({
      orderId: order._id,
      originalTransactionId: originalTx ? originalTx._id : undefined,
      type: 'void',
      subtotal: -order.subtotal, // Negate for analytics summing
      discountAmount: -order.discountAmount,
      total: -order.total,
      paymentMethod: order.paymentMethod,
      managerId: authorizedManager._id,
      reason: voidReason
    });
    await transaction.save();

    if (req.io) {"""

new_void = """    order.status = 'voided';
    order.voidedBy = authorizedManager._id;
    order.voidReason = voidReason;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await order.save({ session });

      // Create a void transaction
      const originalTx = await Transaction.findOne({ orderId: order._id, type: 'sale' }).session(session);
      
      const transaction = new Transaction({
        orderId: order._id,
        originalTransactionId: originalTx ? originalTx._id : undefined,
        type: 'void',
        subtotal: -order.subtotal, // Negate for analytics summing
        discountAmount: -order.discountAmount,
        total: -order.total,
        paymentMethod: order.paymentMethod,
        managerId: authorizedManager._id,
        reason: voidReason
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }

    if (req.io) {"""

content = content.replace(old_void, new_void, 1)

with open('/Users/apple/Meza/backend/routes/orders.js', 'w') as f:
    f.write(content)

