const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const extend = require('xtend')
const writeFile = require('write-file-atomic')
// fork of cb-blockr
const Blockr = require('@tradle/cb-blockr')
const tradle = require('@tradle/engine')
const utils = tradle.utils
const createKeeper = require('@tradle/keeper')
const Wallet = require('@tradle/simple-wallet')
const debug = require('./debug')

module.exports = exports = {
  load,
  genNewIdentity,
  loadOrGen,
  createNode,
  tlsKey,
  tlsPubKey,
  pairs
}

function load (opts, cb) {
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
}

function genNewIdentity (opts, cb) {
  const dir = opts.dir
  debug('generating a new account in ' + opts.dir)

  try {
    mkdirp.sync(dir)
  } catch (err) {
    debug('mkdir failed', err)
    return process.nextTick(() => cb(err))
  }

  utils.newIdentity(opts, function (err, result) {
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
}

function loadOrGen (opts, cb) {
  load(opts, function (err, result) {
    if (!err) return cb(null, result)

    genNewIdentity(opts, function (err, result) {
      if (err) return cb(err)

      cb(null, result)
    })
  })
}

function createNode (opts) {
  const keeper = createKeeper({
    path: getKeeperPath(opts.dir),
    encryption: opts.encryption,
    db: opts.leveldown
  })

  const blockchain = opts.blockchain || new Blockr(opts.networkName)
  const transactor = opts.transactor || Wallet.transactor({
    networkName: opts.networkName,
    priv: utils.chainKey(opts.keys).priv,
    blockchain: blockchain
  })

  const nodeOpts = extend({
    keeper,
    transactor,
    blockchain
  }, utils.omit(opts, 'encryption'))

  return new tradle.node(nodeOpts)
}

function tlsKey (keys) {
  return utils.find(keys, k => k.get('purpose') === 'tls').priv
}

function tlsPubKey (keys) {
  const pk = utils.find(keys, k => {
    const purpose = k.purpose || k.get('purpose')
    return purpose === 'tls'
  })

  const str = pk.pubKeyString || pk.pub
  return new Buffer(pk, 'hex')
}

function pairs (arr) {
  return arr.map(a => {
    return arr.filter(b => b !== a).map(b => [a, b])
  })
  .reduce((all, next) => all.concat(next))
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
