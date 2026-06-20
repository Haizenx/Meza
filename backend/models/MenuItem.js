const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  photoUrl: { type: String }, // Cloudinary URL
  isAvailable: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  stockQuantity: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  modifierGroups: [{
    name: { type: String, required: true },
    multiSelect: { type: Boolean, default: false },
    options: [{
      name: { type: String, required: true },
      price: { type: Number, default: 0 }
    }]
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update updatedAt on save
menuItemSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
