const dateFormat = require('dateformat'),
  db = require('../models')
const axios = require('axios')
const qs = require('querystring')

// Fake ali order and status
const makeAliOrders = async (placeOrder) => {
  try {
    let oList = await generateAliOrders(placeOrder)
    let ids = []
    for (let i in oList) {
      oList[i].rawRequest = placeOrder
      const newOrder = await db.Order.create(oList[i])
      console.log('New Ali order created', newOrder)
      ids.push(newOrder.refId)
    }
    return {
      aliexpress_trade_buy_placeorder_response: {
        result: {
          order_list: {
            number: ids,
          },
          is_success: true
        }
      }
    }
  } catch (err) {
    console.log('Mongo error: ', err)
    return {
      'error_response': {
        'code': 500,
        'msg': err,
        'request_id': 'omzasbw0d7w8'
      }
    }
  }
}

const parseAddressCommands = (addressStr) => {
  let result = {
    order_status: '',
    logistics_status: '',
  }
  const cmds = addressStr.split(',')
  for (let i in cmds) {

    let cmd = cmds[i].trim().split(':')
    if (cmd.length < 2) {
      continue
    }
    switch (cmd[0]) {
      case 'os':
        result.order_status = cmd[1].trim()
        break
      case 'ls':
        result.logistics_status = cmd[1].trim()
    }
  }

  return result
}

const generateAliOrders = async (placeOrder) => {
  const defaultShippingPrice = 0.9
  let productIds = []
  let productsMap = {}
  let storeMap = {}
  let storeMapProducts = {}
  let orderList = []

  const cmds = parseAddressCommands(placeOrder.logistics_address.address)
  let orderStatus = cmds.order_status || 'FUND_PROCESSING'
  let logisticStatus = cmds.logistics_status || 'SELLER_SEND_GOODS'

  for (let i = 0; i < placeOrder.product_items.length; i++) {
    const p = placeOrder.product_items[i]
    productIds.push(p.product_id)
    productsMap[p.product_id] = p
  }

  // get products
  const products = await db.Product.find({refId: {$in: productIds}})

  for (let i in products) {
    const product = products[i].toObject()
    const storeInfo = product.store_info
    console.log('=========== Product Ref Id ', product.refId)

    if (!storeMap[storeInfo.store_id]) {
      storeInfo.store_url = 'https://www.aliexpress.com/store/' + storeInfo.store_id
      storeMap[storeInfo.store_id] = storeInfo
    }

    if (!storeMapProducts[storeInfo.store_id]) {
      storeMapProducts[storeInfo.store_id] = []
    }
    storeMapProducts[storeInfo.store_id].push(product)
  }

  for (let storeId in storeMapProducts) {
    const pList = storeMapProducts[storeId]
    let totalPrice = 0.0
    let childOrderList = []
    let logisticServices = {}
    let logisticInfos = []

    // get child order info
    for (let i in pList) {
      const p = pList[i]
      const op = productsMap[p.refId]
      const skus = p.aeop_ae_product_s_k_us.aeop_ae_product_sku
      let selectedSku = {}
      for (let si in skus) {
        if (skus[si].id === op.sku_attr) {
          selectedSku = skus[si]
        }
      }

      if (op.logistics_service_name) {
        logisticServices[op.logistics_service_name] = op.logistics_service_name
      }

      let amount = selectedSku.offer_sale_price ? selectedSku.offer_sale_price : selectedSku.sku_price
      totalPrice += parseFloat(amount)
      const childOrder = {
        product_id: p.refId,
        product_price: {
          amount: amount,
          currency_code: 'USD'
        },
        product_name: p.subject,
        product_count: op.product_count
      }
      childOrderList.push(childOrder)
    }

    if (logisticStatus === 'SELLER_SEND_GOODS') {
      // fake logistic info
      for (let n in logisticServices) {
        logisticInfos.push({
          logistics_no: 'TEST' + Math.random().toString(20).substr(4).toUpperCase(),
          logistics_service: logisticServices[n],
        })
      }
    }

    totalPrice += defaultShippingPrice
    let order = {
      gmt_create: dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss'),
      order_status: orderStatus,
      logistics_status: logisticStatus,
      order_amount: {
        amount: totalPrice.toString(),
        currency_code: 'USD'
      },
      child_order_list: childOrderList,
      logistics_info_list: logisticInfos,
      store_info: storeMap[storeId],
    }

    orderList.push(order)
  }
  return orderList
}

// TODO: needs refactor DRY
const getAliOrder = async (topClient, orderQuery, method, req) => {
  let o
  const oQ = JSON.parse(orderQuery)
  try {
    o = await db.Order.findOne({refId: oQ.order_id})
    // If not found data from mongo, try get product from ali
    if (!o) {

      // Make request to aliexpress api based on client params
      // const data = await topClient.execute(method, {
      //   format: 'json',
      //   timestamp: dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss'),
      //   sign_method: 'md5',
      //   single_order_query: orderQuery,
      //   session: process.env.TEMP_TOKEN,
      // })

      // Forward request from client to aliexpress api
      const res = await axios({
        url: '/rest',
        method: 'post',
        baseURL: 'https://api.taobao.com/router',
        data: qs.stringify(req.body),
        params: req.query,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      if (res.data.aliexpress_trade_ds_order_get_response
          && res.data.aliexpress_trade_ds_order_get_response.result) {
        o = new db.Order(res.data.aliexpress_trade_ds_order_get_response.result)
        o.refId = oQ.order_id
        o.updatedAt = (new Date()).getTime()
        await o.save()
        console.log('Save Ali Order', res.data.aliexpress_trade_ds_order_get_response.result)
      } else {
        return res.data
      }

    } else {
      const dt = new Date()
      
      // Refresh data every 6 hours
      // TODO: need move to global configs
      dt.setTime(dt.getTime() - (6 * 60 * 60 * 1000)) // 6 hours
      if (o.updatedAt < dt.getTime()) {
        await o.remove()
        const resU = await axios({
          url: '/rest',
          method: 'post',
          baseURL: 'https://api.taobao.com/router',
          data: qs.stringify(req.body),
          params: req.query,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })

        if (resU.data.aliexpress_trade_ds_order_get_response.result) {
          o = new db.Order(resU.data.aliexpress_trade_ds_order_get_response.result)
          o.refId = oQ.order_id
          o.updatedAt = (new Date()).getTime()
          await o.save()
          console.log('Save Ali Order', resU.data.aliexpress_trade_ds_order_get_response.result)
        }
      }
      console.log('Request get order from Mongo', oQ.order_id)
    }
  } catch (err) {
    console.log('Mongo error', err)
    return {
      'error_response': {
        'code': 500,
        'msg': err,
        'request_id': 'th1si5at3str3que5t'
      }
    }
  }

  return {
    aliexpress_trade_ds_order_get_response: {
      result: o,
      request_id: (new Date()).getTime().toString()
    }
  }
}

module.exports = {
  makeAliOrders,
  getAliOrder
}
