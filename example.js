
const tcp = require('./tcp')
const path = require('path')
const leveldown = require('leveldown')
const async = require('async')
const utils = require('./utils')
const debug = require('./debug')

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

  async.parallel([
    done => alice.addContact(bob.identity, done),
    done => bob.addContact(alice.identity, done)
  ], err => {
    if (err) throw err

    const aliceServer = tcp.createServer({ port: 12345 })
    alice._send = function (data, recipient, cb) {
      aliceServer.send(data, cb)
    }

    aliceServer.on('data', data => {
      alice.receive(data, bob._recipientOpts, logErr)
    })

    aliceServer.on('error', console.error)

    const bobClient = tcp.createClient({ port: 12345 })
    bobClient.on('error', console.error)

    bob._send = bobClient.send
    bobClient.on('data', data => {
      bob.receive(data, alice._recipientOpts, logErr)
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

    bob.on('message', function (message) {
      console.log('bob received a message from alice', message)
    })

    alice.on('message', function (message) {
      console.log('alice received a message from bob', message)
    })
  })
})

function logErr (err) {
  if (err) {
    console.error(err)
    console.error(err.stack)
  }
}
