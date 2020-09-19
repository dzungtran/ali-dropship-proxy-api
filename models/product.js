const mongoose = require('mongoose')
const productSchema = new mongoose.Schema({
  refId: Number,
  updatedAt: Number,
}, {strict: false})

module.exports = mongoose.model('Product', productSchema, 'product')
