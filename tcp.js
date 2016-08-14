
const net = require('net')
const through = require('through2')
const eos = require('end-of-stream')
const duplexify = require('duplexify')
const lps = require('length-prefixed-stream')
// const wire = require('@tradle/wire')

module.exports = {
  createClient,
  createServer
}

function createClient (opts) {
  const connection = opts.path ? net.connect(opts.path, opts.port) : net.connect(opts.port)
  const wrapper = wrapConnection(connection)
  return wrapper
}

function createServer (opts) {
  var connections = []
  const server = net.createServer(function (connection) {
    const wrapper = wrapConnection(connection)
    connections.push(wrapper)

    eos(wrapper, () => {
      connections = connections.filter(c => c !== wrapper)
    })

    wrapper.on('error', err => server.emit('error', err))
    wrapper.on('data', data => server.emit('data', data))

    server.emit('client', connection)
  })

  server.listen(opts.port)
  server.send = function (data, cb) {
    // hack for testing
    connections[0].send(data, cb)
  }

  return server
}

function wrapConnection (connection) {
  const encode = lps.encode()
  const decode = lps.decode()
  encode.pipe(connection).pipe(decode)

  const wrapper = duplexify.obj(encode, decode)
  wrapper.send = function (data, cb) {
    wrapper.write(data, cb)
  }

  // re-emit 'data' as 'message'
  // wrapper.on('data', data => wrapper.emit('message', data))
  return wrapper
}
