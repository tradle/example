# Usage

This example shows how to set up a tradle node, plug it into the network, and send/receive messages. A websocket relay is used to facilitate communication between the two nodes. For simplicity, both nodes are run in one process: example.js

Start a websocket relay

```bash
DEBUG=websocket-relay node relay.js
```

Run the example

```bash
DEBUG=tradle:* node example.js
```
