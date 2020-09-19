const dateFormat = require('dateformat'),
  db = require('../models')
const axios = require('axios')
const qs = require('querystring')

const getAliProduct = async (topClient, pId, method, req) => {
  let p
  try {
    p = await db.Product.findOne({refId: pId})
    console.log(p)
    // try get product from ali
    if (!p) {
      // const data = await topClient.execute(method, {
      //   format: 'json',
      //   timestamp: dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss'),
      //   sign_method: 'md5',
      //   product_id: pId,
      //   session: process.env.TEMP_TOKEN,
      // })
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
      if (res.data.aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response
          && res.data.aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response.result) {
        p = new db.Product(res.data.aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response.result)
        p.refId = pId
        p.updatedAt = (new Date()).getTime()
        await p.save()
        console.log('Save Ali Product')
      } else {
        return res.data
      }
    } else {

      const dt = new Date()
      dt.setTime(dt.getTime() - (6 * 60 * 60 * 1000)) // 6 hours
      // dt.setTime(dt.getTime() - (60*1000)) // 1 minute
      if (p.updatedAt < dt.getTime()) {
        await p.remove()
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
        if (resU.data.aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response.result) {
          p = new db.Product(resU.data.aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response.result)
          p.refId = pId
          p.updatedAt = (new Date()).getTime()
          await p.save()
          console.log('Save Ali Product', resU.data.aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response.result)
        }
      }
      console.log('Request get product from Mongo', pId)
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
    aliexpress_postproduct_redefining_findaeproductbyidfordropshipper_response: {
      result: p,
      request_id: (new Date()).getTime().toString()
    }
  }
}

module.exports = {
  getAliProduct
}
