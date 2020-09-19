# ali-dropship-proxy-api

A barebones Node.js app using [Express 4](http://expressjs.com/).

## Running Locally

Make sure you have [Node.js](http://nodejs.org/) and the [Heroku CLI](https://cli.heroku.com/) installed.
And a MongoDB have two collection `product` and `order`

```sh
$ git clone https://github.com/dzungtran/ali-dropship-proxy-api.git # or clone your own fork
$ cd ali-dropship-proxy-api
$ npm install
$ cp .env.example .env # may you need update `MONGODB_URI`
$ npm start # or `heroku local`, If you used heroku already
```

Your app should now be running on [localhost:5000](http://localhost:5000/).

## Deploying to Heroku

```
$ heroku create
$ git push heroku master
$ heroku open
```
or

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)