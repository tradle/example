const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const extend = require('xtend')
const writeFile = require('write-file-atomic')
// fork of cb-blockr
const Blockr = require('@tradle/cb-blockr')
const tradle = require('@tradle/engine')
const tradleUtils = tradle.utils
const createKeeper = require('@tradle/keeper')
const Wallet = require('@tradle/simple-wallet')
const debug = require('./debug')

const utils = module.exports = exports = {
  load: function load (opts, cb) {
    // ensure async
    const dir = opts.dir
    debug('attempting to load account from ' + dir)
    process.nextTick(function () {
      var err
      try {
        opts = extend(opts, {
          keys: require(getKeysPath(dir)),
          identity: require(getIdentityPath(dir))
        })

        debug('loaded account from ' + dir)
      } catch (e) {
        err = e
        debug('failed to load account from ' + dir)
      }

      if (err) cb(err)
      else cb(null, opts)
    })
  },

  genNewIdentity: function genNewIdentity (opts, cb) {
    const dir = opts.dir
    debug('generating a new account in ' + opts.dir)

    try {
      mkdirp.sync(dir)
    } catch (err) {
      debug('mkdir failed', err)
      return process.nextTick(() => cb(err))
    }

    tradleUtils.newIdentity(opts, function (err, result) {
      if (err) {
        debug('failed to generate account', err)
        return cb(err)
      }

      try {
        writeFile.sync(getKeysPath(dir), JSON.stringify(result.keys))
        writeFile.sync(getIdentityPath(dir), JSON.stringify(result.identity))
      } catch (err) {
        debug('failed to write account data', err)
        return cb(err)
      }

      debug('generated account in ' + dir)
      cb(null, extend(opts, result))
    })
  },

  loadOrGen: function loadOrGen (opts, cb) {
    utils.load(opts, function (err, result) {
      if (!err) return cb(null, result)

      utils.genNewIdentity(opts, function (err, result) {
        if (err) return cb(err)

        cb(null, result)
      })
    })
  },

  createNode: function createNode (opts) {
    const keeper = createKeeper({
      path: getKeeperPath(opts.dir),
      encryption: opts.encryption,
      db: opts.leveldown
    })

    const blockchain = opts.blockchain || new Blockr(opts.networkName)
    const transactor = opts.transactor || Wallet.transactor({
      networkName: opts.networkName,
      priv: tradleUtils.chainKey(opts.keys).priv,
      blockchain: blockchain
    })

    const nodeOpts = extend({
      keeper,
      transactor,
      blockchain
    }, tradleUtils.omit(opts, 'encryption'))

    return new tradle.node(nodeOpts)
  }
}

function getIdentityPath (dir) {
  return path.join(dir, 'identity.json')
}

function getKeysPath (dir) {
  return path.join(dir, 'keys.json')
}

function getKeeperPath (dir) {
  return path.join(dir, 'keeper.db')
}
