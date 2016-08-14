
const tcp = require('./tcp')
const path = require('path')
const leveldown = require('leveldown')
const async = require('async')
const utils = require('./utils')
const debug = require('./debug')
const setupWS = require('./ws-stack')
const TLS_ENABLED = true

const aliceOpts = {
  networkName: 'testnet',
  dir: path.join(process.env.HOME, '.tradle/alice'),
  encryption: {
    password: 'pets-car-health-separate-even-head-baloney'
  },
  // every 10 mins
  syncInterval: 300000,
  leveldown: leveldown
}

const bobOpts = {
  networkName: 'testnet',
  dir: path.join(process.env.HOME, '.tradle/bob'),
  encryption: {
    password: 'insecure-mercury-moon-dog-apple-rainbow-nash'
  },
  // every 10 mins
  syncInterval: 300000,
  leveldown: leveldown
}

async.map([
  aliceOpts,
  bobOpts
], utils.loadOrGen, function (err, results) {
  if (err) throw err

  const alice = utils.createNode(results[0])
  const bob = utils.createNode(results[1])

  meet([alice, bob], err => {
    if (err) throw err

    alice.on('message', function (message) {
      console.log('alice received a message from bob', message)
    })

    bob.on('message', function (message) {
      console.log('bob received a message from alice', message)
    })

    haveTCPFun(alice, bob)
    // haveWebsocketsFun(alice, bob)
  })
})

/**
 * Add each other to respective address books
 */
function meet (nodes, cb) {
  async.each(utils.pairs(nodes), function meet (pair, done) {
    pair[0].addContact(pair[1].identity, done)
  }, cb)
}

function connectTCP (alice, bob) {
  const aliceServer = tcp.createServer({
    port: 12345,
    // TLS using axolotl
    key: TLS_ENABLED && utils.tlsKey(alice.keys),
    theirPubKey: TLS_ENABLED && utils.tlsPubKey(bob.identity.pubkeys)
  })

  alice._send = function (data, recipient, cb) {
    aliceServer.send(data, cb)
  }

  aliceServer.on('message', function (data, from) {
    if (!TLS_ENABLED) from = bob._recipientOpts

    alice.receive(data, from, logErr)
  })

  aliceServer.on('error', console.error)

  const bobClient = tcp.createClient({
    port: 12345,
    // TLS using axolotl
    key: TLS_ENABLED && utils.tlsKey(bob.keys),
    theirPubKey: TLS_ENABLED && utils.tlsPubKey(alice.identity.pubkeys)
  })

  bobClient.on('error', console.error)

  bob._send = function (data, recipient, cb) {
    bobClient.send(data, cb)
  }

  // dedicated wire to talk to alice
  bobClient.on('message', function (data) {
    bob.receive(data, alice._recipientOpts, logErr)
  })
}

function connectWebSockets (alice, bob) {
  const url = 'ws://localhost:42824'
  connect(url, alice)
  connect(url, bob)

  function connect (url, node) {
    const setup = setupWS(node)
    const stack = setup.networkingStack({
      url: url,
      tls: TLS_ENABLED
    })

    // stack.on('error', logErr)
  }
}

function haveWebsocketsFun (alice, bob) {
  connectWebSockets(alice, bob)
  chat(alice, bob)
}

function haveTCPFun (alice, bob) {
  connectTCP(alice, bob)
  chat(alice, bob)
}

function chat (alice, bob) {
  alice.signAndSend({
    to: bob._recipientOpts,
    object: {
      _t: 'some-type',
      hey: 'bob!'
    }
  }, logErr)

  bob.signAndSend({
    to: alice._recipientOpts,
    object: {
      _t: 'some-type',
      hey: 'alice!'
    }
  }, logErr)
}

process.on('uncaughtException', function (e) {
  logErr(e)
  process.exit(1)
})

function logErr (err) {
  if (err) {
    console.error(err)
    console.error(err.stack)
    if (err.tfError) {
      console.error(err.tfError.stack)
    }
  }
}
