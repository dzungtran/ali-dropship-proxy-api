require('dotenv').config()

const express = require('express'),
  bodyParser = require('body-parser'),
  TopClient = require('topsdk'),
  mongoose = require('mongoose'),
  dateFormat = require('dateformat'),
  autoIncrement = require('mongoose-auto-increment'),
  orderUtils = require('./utils/order'),
  productUtils = require('./utils/product'),
  db = require('./models')

// create express app
const app = express()
const PORT = process.env.PORT || 5000

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

// ==== DB connect ====
mongoose.Promise = global.Promise
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true
})
  .then(() => console.log('connection successful'))
  .catch((err) => console.error(err))

autoIncrement.initialize(mongoose.connection)

// ==== Taobao client ====
const topClient = new TopClient(process.env.APP_KEY, process.env.APP_SECRET, {
  endpoint: 'https://api.taobao.com/router/rest',
  useValidators: false,
  rawResponse: false
})

// ==== Routers ====
app.get('/', (req, res) => {
  res.json({'message': 'Welcome to AliExpress Proxy API.'})
})

app.post('/router/rest', async (req, res) => {
  
  console.log('===================',
    '\nBODY:', req.body,
    '\nQUERY:', req.query,
    '\n===================')

  const method = req.query.method,
    pId = req.body.product_id,
    oQuery = req.body.single_order_query,
    placeOrder = req.body.param_place_order_request4_open_api_d_t_o

  switch (method) {
    // Handler get Ali product details
    case 'aliexpress.postproduct.redefining.findaeproductbyidfordropshipper':
      const p = await productUtils.getAliProduct(topClient, pId, method, req)
      return res.json(p)

    // Handler get Ali order details, fake order
    case 'aliexpress.trade.ds.order.get':
      const o = await orderUtils.getAliOrder(topClient, oQuery, method, req)
      return res.json(o)

    // Handler place Ali order
    case 'aliexpress.trade.buy.placeorder':
      const pO = JSON.parse(placeOrder)
      const placeOrderResult = await orderUtils.makeAliOrders(pO)
      return res.json(placeOrderResult)
  }

  return res.json({'message': method})
})

app.listen(PORT, () => console.log(`Listening on ${PORT}`))

