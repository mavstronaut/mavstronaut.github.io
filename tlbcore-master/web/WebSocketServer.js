'use strict';
/*
  The server side (nodejs) of a WebSocket connection.
  The API is symmetrical, but the browser end is implemented in WebSocketBrowser because of the narcissism of small differences.

  Call mkWebSocketRpc(aWebSocketRequest, aWebSocketConnection, handlers)

  handlers should be {
    cmd_foo: function(msg) { do something }
    req_bar: function(msg, cb) { do something, then call cb(answer); to reply }
  }
  This module also fills in some new fields in handlers, like .tx = a function to send on the websocket, and .label = a name for it useful for logging
  So you can initiate a one-way command with

  handlers.tx({cmdReq: 'foo', fooInfo: ...})

  Or do an RPC with
    handlers.rpc('foo', 'bar', function(err, info) {
    });
  it will call req_foo on the other end with a callback which routes back to the callback above.


  Info:
    https://developer.mozilla.org/en-US/docs/WebSockets/Writing_WebSocket_client_applications
    https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
    http://www.w3.org/TR/websockets/
    https://tools.ietf.org/html/rfc6455
    https://github.com/Worlize/WebSocket-Node/wiki/Documentation
*/
var _                   = require('underscore');
var logio               = require('./logio');
var WebSocketHelper     = require('./WebSocketHelper');

var verbose = 1;

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsr, wsc, handlers) {
  var pending = new WebSocketHelper.RpcPendingQueue();
  var callbacks = {};
  var rxBinaries = [];

  setupHandlers();
  if (handlers.start) {
    handlers.start();
  }
  if (handlers.grabAuth) {
    handlers.grabAuth(wsr.httpRequest);
  }
  setupWsc();
  return handlers;

  function setupWsc() {
    wsc.on('message', function(event) {
      if (event.type === 'utf8') {
        if (verbose >= 3) logio.I(handlers.label, event.utf8Data);
        var msg = WebSocketHelper.parse(event.utf8Data, rxBinaries);
        rxBinaries = [];
        handleMsg(msg);
      }
      else if (event.type === 'binary') {
        if (verbose >= 3) logio.I(handlers.label, 'Binary len=' + event.binaryData.byteLength);
        rxBinaries.push(event.binaryData);
      }
      else {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown type ' + event.type);
      }
    });
    wsc.on('close', function(code, desc) {
      if (verbose >= 1) logio.I(handlers.label, 'close', code, desc);
      if (handlers.close) handlers.close();
    });
  }

  function handleMsg(msg) {
    if (msg.cmdReq) {
      var cmdFunc = handlers['cmd_' + msg.cmdReq];
      if (!cmdFunc) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown cmdReq in', msg);
        return;
      }
      if (verbose >= 2) logio.I(handlers.label, 'cmd', msg.cmdReq, msg.cmdArgs)
      cmdFunc.apply(handlers, msg.cmdArgs);
    }
    else if (msg.rpcReq) {
      var reqFunc = handlers['req_' + msg.rpcReq];
      if (!reqFunc) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown rpcReq in ', msg);
        return;
      }
      var done = false;
      if (verbose >= 2) logio.I(handlers.label, 'rpc', msg.rpcReq, msg.rpcArgs)
      try {
        reqFunc.apply(handlers, msg.rpcArgs.concat([function(/* ... */) {
          var rpcRet = Array.prototype.slice.call(arguments, 0);
          if (!(rpcRet.length > 0 && rpcRet[0] === 'progress')) {
            done = true;
          }
          handlers.tx({ rpcId: msg.rpcId, rpcRet: rpcRet });
        }]));
      } catch(ex) {
        logio.E(handlers.label, 'Error handling', msg, ex);
        if (!done) {
          done = true;
          handlers.tx({rpcId: msg.rpcId, rpcRet: [ex.toString()]});
        }
      }
    }
    else if (msg.rpcId) {
      var rpcRet = msg.rpcRet || [];
      var rpcCb;
      if (rpcRet.length > 0 && rpcRet[0] === 'progress') {
        rpcCb = pending.getPreserve(msg.rpcId);
      } else {
        rpcCb = pending.get(msg.rpcId);
      }
      if (!rpcCb) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown response', msg.rpcId);
        return;
      }
      if (verbose >= 2) logio.I(handlers.label, 'return', msg.rpcRet)
      rpcCb.apply(handlers, msg.rpcRet);
    }
    else if (msg.hello) {
      handlers.hello = msg.hello;
      if (handlers.onHello) handlers.onHello();
    }
    else {
      if (verbose >= 1) logio.E(handlers.label, 'Unknown message', msg);
    }
  }

  function setupHandlers() {
    handlers.remoteLabel = handlers.label = wsr.remoteLabel;
    handlers.cmd = function(cmdReq /*...*/) {
      var args = Array.prototype.slice.call(arguments, 1);
      handlers.tx({cmdReq: cmdReq, cmdArgs: args});
    };
    handlers.rpc = function(rpcReq /* ... */) {
      if (arguments.length < 2) throw new Error('rpc: bad args');
      var rpcId = pending.getnewId();
      var rspFunc = arguments[arguments.length - 1];
      var rpcArgs = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      pending.add(rpcId, rspFunc);
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, rpcArgs: rpcArgs});
    };
    handlers.callback = function(rpcReq /* ... */) {
      if (arguments.length < 2) throw new Error('rpc: bad args');
      var rpcId = pending.getNewId();
      var rspFunc = arguments[arguments.length - 1];
      var rpcArgs = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      callbacks[rpcId] = rspFunc;
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, rpcArgs: rpcArgs});
    };
    handlers.tx = function(msg) {
      emitMsg(msg);
    };
  }

  function emitMsg(msg) {
    var binaries = [];
    var json = WebSocketHelper.stringify(msg, binaries);
    _.each(binaries, function(data) {
      // See http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
      // and http://nodejs.org/api/buffer.html
      var buf = Buffer.isBuffer(data) ? data : new Buffer(new Uint8Array(data));
      if (verbose >= 3) logio.O(handlers.label, 'buffer length ' + buf.length);
      wsc.sendBytes(buf);
    });
    wsc.sendUTF(json);
    if (verbose >= 2) logio.O(handlers.label, json);
  }
}
