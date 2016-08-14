const TLSClient = require('sendy-axolotl')
const Sendy = require('sendy')
const SendyWS = require('sendy-ws')
const newSwitchboard = SendyWS.Switchboard
const WebSocketClient = SendyWS.Client
const tradle = require('@tradle/engine')
// const utils = require('./utils')

module.exports = function createConnector (node) {
  const connector = {
    myIdentifier: function (tls) {
      return connector.getIdentifier(node.identity, tls)
    },

    getIdentifier: function (identity, tls) {
      const pk = tls ? tradle.utils.find(identity.pubkeys, k => {
        return k.type === 'ec' && k.purpose === 'tls'
      }) : tradle.utils.find(identity.pubkeys, k => {
        return k.type === 'ec' && k.purpose === 'sign'
      })

      return tradle.utils.serializePubKey(pk).toString('hex')
    },

    parseIdentifier: function (identifier) {
      const pubKey = tradle.utils.unserializePubKey(new Buffer(identifier, 'hex'))
      pubKey.pub = new Buffer(pubKey.pub, 'hex')
      return pubKey
    },

    networkingStack: function (opts) {
      const url = opts.url
      const tlsEnabled = opts.tls
      const webSocketClient = new WebSocketClient({
        url: url,
        autoConnect: true,
        // for now, till we figure out why binary
        // doesn't work (socket.io parser errors on decode)
        // forceBase64: true
      })

      webSocketClient.on('disconnect', function () {
        switchboard.clients().forEach(function (c) {
          // reset OTR session, restart on connect
          debug('aborting pending sends due to disconnect')
          c.destroy()
        })

        // pause all channels
        node.sender.pause()
      })

      webSocketClient.on('connect', function (recipient) {
        // resume all paused channels
        node.sender.resume()
      })

      const tlsKey = tlsEnabled && tradle.utils.find(node.keys, key => {
        return key.get('purpose') === 'tls'
      })

      const switchboard = newSwitchboard({
        identifier: connector.myIdentifier(tlsEnabled),
        unreliable: webSocketClient,
        clientForRecipient: function (recipient) {
          const sendy = new Sendy(opts)
          if (!tlsKey) return sendy

          return new TLSClient({
            key: {
              secretKey: tlsKey.priv,
              publicKey: tlsKey.pub
            },
            client: sendy,
            theirPubKey: new Buffer(connector.parseIdentifier(recipient).pub, 'hex')
          })
        }
      })

      switchboard.on('timeout', function (identifier) {
        switchboard.cancelPending(identifier)
      })

      node._send = function (msg, recipientInfo, cb) {
        const identifier = connector.getIdentifier(recipientInfo.object, tlsEnabled)
        switchboard.send(identifier, msg, cb)
      }

      switchboard.on('message', function (msg, sender) {
        const pubKey = connector.parseIdentifier(sender)
        node.receive(msg, { pubKey })
      })

      return {
        switchboard,
        webSocketClient
      }
    }
  }

  return connector
}
