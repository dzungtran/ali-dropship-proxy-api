const mongoose = require('mongoose'),
  autoIncrement = require('mongoose-auto-increment')

const Schema = mongoose.Schema
const orderSchema = new Schema({
  refId: {type: Number, index: true},
  updatedAt: Number,
}, {strict: false})


autoIncrement.initialize(mongoose.connection)
orderSchema.plugin(autoIncrement.plugin, {
  model: 'Order',
  field: 'refId',
  startAt: 801226824979,
  incrementBy: 3
})

module.exports = mongoose.model('Order', orderSchema, 'order')
