const mongoose = require('mongoose');
const User = require('./User');

const listingSchema = new mongoose.Schema({
  UserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  Price: {
    type: Number,
    required: true,
  },
  rent_sale: {
    type: String,
    required: true,
  },
  Furnished: {
    type:String,
    required: true,
  },
  Facilities: {
    type: [String], // Changed to an array to support multiple amenities
    required: true,
  },
  City: {
    type: String,
    required: true,
  },
  Bedrooms: {
    type: Number, // Changed to Number for easier numerical operations
    required: true,
  },
  Bathrooms: {
    type: Number, // Changed to Number for easier numerical operations
    required: true,
  },
  PropertySize: {
    type: Number, // Changed to Number for easier numerical operations
    required: true,
  },
  PropertyAge: {
    type: Number, // Changed to Number for easier numerical operations
    required: true,
  },
  Keywords: {
    type: String, // Changed to an array if multiple keywords are needed
    required: true,
  },
  Description: {
    type: String,
    required: true,
  },
  PropType: {
    type: String,
    required: true,
  },
  Title: {
    type: String,
    required: true,
  },
  Neighborhood: {
    type: String,
    required: true,
  },
  File: {
    type: [String],
    required: true,
  },
  status: {
    type: String,
    enum: ['live', 'expired'],
    default: 'live'
  },
  AdOwner: {
    type: String,
    required: false,
    default: "rwerwe"
  },
}, {
  timestamps: true // Add this option to enable timestamps
});

module.exports = mongoose.model('Listing', listingSchema);
