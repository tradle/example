
const net = require('net')
const through = require('through2')
const eos = require('end-of-stream')
const duplexify = require('duplexify')
const lps = require('length-prefixed-stream')
const Wire = require('@tradle/wire')
const utils = require('./utils')

module.exports = {
  createClient,
  createServer
}

function createClient (opts) {
  const connection = opts.path ? net.connect(opts.path, opts.port) : net.connect(opts.port)
  return createWire(connection, opts)
}

function createServer (opts) {
  var wires = []
  var pubKeyToWire = {}
  const tlsEnabled = !!opts.key
  const server = net.createServer(function (connection) {
    var pubKey
    const wire = createWire(connection, opts)
    wires.push(wire)

    eos(wire, () => {
      wires = wires.filter(c => c !== wire)
      if (pubKey) delete pubKeyToWire[pubKey]
    })

    wire.on('error', err => server.emit('error', err))

    wire.on('handshake', handshake => {
      pubKey = {
        type: 'ec',
        curve: 'curve25519',
        pub: handshake.staticKey
      }

      pubKeyToWire[handshake.staticKey.toString('hex')] = wire
      wire.acceptHandshake(handshake)
    })

    wire.on('message', data => {
      if (!tlsEnabled) return server.emit('message', data)

      server.emit('message', data, { pubKey })
    })
  })

  server.listen(opts.port)
  server.send = function (data, recipient, cb) {
    // hack for testing
    if (!tlsEnabled) {
      // without authentication, we have no idea
      // who we're talking to
      return wires.forEach(w => w.send(data, cb))
    }

    const pubKey = utils.tlsPubKey(recipient.object.pubkeys)
    const wire = pubKeyToWire[pubKey.toString('hex')]
    if (!wire) return cb(new Error('recipient not found'))

    wire.send(data, cb)
  }

  return server
}

function createWire (connection, opts) {
  return opts.key ? createEncryptedWire(connection, opts) : createCleartextWire(connection, opts)
}

function createEncryptedWire (connection, opts) {
  const wire = new Wire({
    identity: opts.key,
    theirIdentity: opts.theirPubKey
  })

  wire.pipe(connection).pipe(wire)
  return wire
}

function createCleartextWire (connection, opts) {
  const encode = lps.encode()
  const decode = lps.decode()
  encode.pipe(connection).pipe(decode)

  const wrapper = duplexify.obj(encode, decode)
  wrapper.on('data', data => wrapper.emit('message', data))
  wrapper.send = wrapper.write
  return wrapper
}
