const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  photoUrl: { type: String }, // Cloudinary URL
  isAvailable: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  sizes: [{
    name: { type: String, required: true },
    price: { type: Number, required: true }
  }],
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
