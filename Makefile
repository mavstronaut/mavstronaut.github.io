
run ::
	node tlbcore/web/server.js oom pong

test:
	mocha --reporter list oom/test_*.js

