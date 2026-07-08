const mongoose = require('mongoose');

const tokenBlocklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900 // Automatically remove documents after 15 minutes (900 seconds)
  }
});

module.exports = mongoose.model('TokenBlocklist', tokenBlocklistSchema);
