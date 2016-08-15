const Relay = require('sendy-ws-relay')
const port = Number(process.argv[2]) || 42824
const relay = new Relay({ port })
console.log('running on port ' + port)
