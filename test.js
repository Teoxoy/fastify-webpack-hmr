'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const get = require('simple-get')
const { join } = require('path')
const plugin = require('./plugin')
const webpack = require('webpack')

test('Decorates instance', t => {
  t.plan(4)

  const opts = {
    config: {
      mode: 'development',
      stats: false,
      entry: join(__dirname, 'example', 'client.js'),
      output: { publicPath: '/assets', filename: 'main.js' }
    },
    webpackDev: { logLevel: 'silent' }
  }

  register(t, opts, (err, fastify) => {
    t.error(err)
    t.equal(typeof fastify.webpackCompiler, 'object')
    t.equal(typeof fastify.webpackDev, 'function')
    t.equal(typeof fastify.webpackHot, 'function')
  })
})

test('Works with custom compiler', t => {
  t.plan(7)
  const opts = {
    mode: 'development',
    entry: join(__dirname, 'example', 'client.js'),
    output: { publicPath: '/assets', filename: 'main.js' }
  }
  const compiler = webpack(opts)
  const webpackDev = { logLevel: 'silent' }

  testHMR(t, { compiler, webpackDev }, 'assets/main.js')
})

test('Works with config option', t => {
  t.plan(7)
  const opts = {
    config: {
      mode: 'development',
      stats: false,
      entry: join(__dirname, 'example', 'client.js'),
      output: { publicPath: '/assets', filename: 'main.js' }
    },
    webpackDev: { logLevel: 'silent' }
  }

  testHMR(t, opts, 'assets/main.js')
})

test('Works with multiple entries', t => {
  t.plan(14)

  const hotConf = 'webpack-hot-middleware/client?path=/__webpack_hmr'
  const opts = {
    config: {
      mode: 'development',
      stats: false,
      entry: {
        first: [join(__dirname, 'example', 'client.js'), hotConf],
        second: [join(__dirname, 'example', 'client.js'), hotConf]
      },
      output: { publicPath: '/assets', filename: '[name].js' }
    },
    webpackDev: { logLevel: 'silent' }
  }

  testHMR(t, opts, 'assets/first.js')
  testHMR(t, opts, 'assets/second.js')
})

test('Throws if no configuration provided', t => {
  t.plan(2)

  const opts = {}

  register(t, opts, (err, fastify) => {
    t.ok(err instanceof Error)
    t.match(err.message, /configuration is missing./)
  })
})

test('Throws if no publicPath option provided', t => {
  t.plan(2)

  const opts = { config: {
    mode: 'development',
    entry: join(__dirname, 'example', 'client.js'),
    stats: false,
    output: { filename: 'main.js' }
  } }

  register(t, opts, (err, fastify) => {
    t.ok(err instanceof Error)
    t.match(err.message, /publicPath must be set/)
  })
})

test('Sets webpackDev publicPath option from config.output.publicPath', t => {
  t.plan(2)

  const opts = { config: {
    mode: 'development',
    entry: join(__dirname, 'example', 'client.js'),
    stats: false,
    output: { filename: 'main.js', publicPath: '/assets' }
  } }

  register(t, opts, (err, fastify) => {
    t.error(err)
    t.equal(fastify.webpackDev.context.options.publicPath, '/assets')
  })
})

test('Respects webpackDev publicPath configuration if it is provided', t => {
  t.plan(2)

  const opts = {
    config: {
      mode: 'development',
      entry: join(__dirname, 'example', 'client.js'),
      stats: false,
      output: { filename: 'main.js', publicPath: '/assets' }
    },
    webpackDev: { noInfo: true, publicPath: '/something-else' }
  }

  register(t, opts, (err, fastify) => {
    t.error(err)
    t.equal(fastify.webpackDev.context.options.publicPath, '/something-else')
  })
})

function register (t, opts, callback) {
  const fastify = Fastify()

  t.tearDown(() => fastify.close())

  fastify
    .register(plugin, opts)
    .ready(err => {
      callback(err, fastify)
    })
}

function testHMR (t, opts, asset) {
  const fastify = Fastify()
  t.tearDown(() => fastify.close())

  fastify.register(plugin, opts)

  fastify.listen(0, err => {
    t.error(err)
    let port = fastify.server.address().port
    get(
      `http://127.0.0.1:${port}/__webpack_hmr`,
      function (err, res) {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.match(res.headers['content-type'], /text\/event-stream/)
        res.destroy()
      }
    )
    get(
      `http://127.0.0.1:${port}/${asset}`,
      function (err, res) {
        t.error(err)
        t.strictEqual(res.statusCode, 200)
        t.match(res.headers['content-type'], /application\/javascript/)
        res.destroy()
      }
    )
  })
}