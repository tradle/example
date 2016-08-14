
const tcp = require('./tcp')
const path = require('path')
const leveldown = require('leveldown')
const async = require('async')
const utils = require('./utils')
const debug = require('./debug')
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

    haveFun(alice, bob)
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

function haveFun (alice, bob) {
  const aliceServer = tcp.createServer({
    port: 12345,
    // TLS using axolotl
    key: TLS_ENABLED && utils.tlsKey(alice.keys),
    theirPubKey: TLS_ENABLED && utils.tlsPubKey(bob.identity.pubkeys)
  })

  alice._send = function (data, recipient, cb) {
    aliceServer.send(data, cb)
  }

  aliceServer.on('message', data => {
    alice.receive(data, bob._recipientOpts, logErr)
  })

  aliceServer.on('error', console.error)

  alice.on('message', function (message) {
    console.log('alice received a message from bob', message)
  })

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

  bobClient.on('message', data => {
    bob.receive(data, alice._recipientOpts, logErr)
  })

  bob.on('message', function (message) {
    console.log('bob received a message from alice', message)
  })

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
  }
}
