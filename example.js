
const path = require('path')
const leveldown = require('leveldown')
const async = require('async')
const tradle = require('@tradle/engine')
const operator = require('@tradle/ws-operator')
const utils = require('./utils')
const debug = require('./debug')
const TLS_ENABLED = false
const relayURL = 'ws://localhost:42824'

console.log(`connecting to relay at ${relayURL}`)
console.log('run `node relay.js` in another tab (if you haven\'t already)')

process.on('uncaughtException', function (e) {
  logErr(e)
  process.exit(1)
})

const aliceOpts = {
  name: 'alice',
  networkName: 'testnet',
  dir: path.join(process.env.HOME, '.tradle/alice'),
  encryption: {
    key: new Buffer('32a663553a35474af72f69b5ea5504b2c56dc91300f8fdf965c926e98b1bbd3b', 'hex')
  },
  // every 10 mins
  syncInterval: 300000,
  leveldown: leveldown
}

const bobOpts = {
  name: 'bob',
  networkName: 'testnet',
  dir: path.join(process.env.HOME, '.tradle/bob'),
  encryption: {
    key: new Buffer('d7d2d648aed2790dcc29fd9721c427ede02a6c298092e5b4820731b8d7dd730e', 'hex')
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

    const aliceOperator = operator.install({ node: alice, tls: TLS_ENABLED })
    const bobOperator = operator.install({ node: bob, tls: TLS_ENABLED })

    aliceOperator.addHost({ url: relayURL })
    bobOperator.addHost({ url: relayURL })

    aliceOperator.addEntry(relayURL, operator.identifier(bob.identityInfo, TLS_ENABLED))
    bobOperator.addEntry(relayURL, operator.identifier(alice.identityInfo, TLS_ENABLED))

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

// function connectToRelay (node, url) {
//   const setup = setupWS({ node, tls: TLS_ENABLED })
//   const stack = setup.networkingStack({
//     url: url,
//     tls: TLS_ENABLED
//   })

//   stack.webSocketClient.on('connect', function () {
//     debug(node.name + ' connected')
//   })

//   stack.webSocketClient.on('disconnect', function () {
//     debug(node.name + ' disconnected')
//   })
// }

function haveFun (alice, bob) {
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

function logErr (err) {
  if (err) {
    console.error(err)
    console.error(err.stack)
    if (err.tfError) {
      console.error(err.tfError.stack)
    }
  }
}
