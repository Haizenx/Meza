const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  localUUID: { type: String, unique: true, required: true },  // idempotency key
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    nameAtSale: { type: String },
    priceAtSale: { type: Number },
    quantity: { type: Number },
    size: { type: String },
    note: { type: String },
    modifiers: [{
      name: { type: String },
      price: { type: Number }
    }]
  }],
  subtotal: { type: Number, required: true },             // server-computed
  discountAmount: { type: Number, default: 0 },
  discountApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  total: { type: Number, required: true },                // server-computed
  paymentMethod: { type: String, enum: ['cash', 'gcash', 'card', 'online', 'split'], required: true },
  splitPayments: [{
    method: { type: String, enum: ['cash', 'gcash', 'card', 'online'] },
    amount: { type: Number }
  }],
  cashTendered: { type: Number },
  changeDue: { type: Number },
  customerName: { type: String },
  cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Not required for QR
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' }, 
  orderType: { type: String, enum: ['pos', 'qr'], default: 'pos' },
  tableNumber: { type: String },
  status: { type: String, enum: ['unpaid', 'completed', 'voided'], default: 'completed' }, // 'unpaid' for 'Pay at Counter' QR orders
  fulfillmentStatus: { type: String, enum: ['pending', 'preparing', 'ready', 'served'], default: 'pending' }, 
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voidReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

orderSchema.index({ localUUID: 1 }, { unique: true, sparse: true });
orderSchema.index({ createdAt: -1, status: 1 });
orderSchema.index({ shiftId: 1 });

module.exports = mongoose.model('Order', orderSchema);
