const fs = require('fs'),
  path = require('path'),
  db = {
    Product: null,
    Order: null
  }

// import all file in this dir, except index.js
fs.readdirSync(__dirname)
  .filter(function (file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js')
  })
  .forEach(function (file) {
    const model = require(path.join(__dirname, file))
    db[model.modelName] = model
  })

module.exports = db
