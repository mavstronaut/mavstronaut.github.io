
# Reasonable user targets
default : build
test ::
build :: stage1
stage1 :: setup
clean ::
setup ::
size ::
node_modules ::

include common/MakeSystem.inc

ifeq ($(UNAME_SYSTEM),Darwin)
export NODE_PATH = /usr/local/lib/node_modules
endif

GYP_MODE ?= Release

# MAINTAINME
JS_SRCDIRS := \
	common \
	code_gen \
	arma \
	numerical \
	geom \
	nodeif \
	web

DECL_TYPES := \
	arma/decl_arma.js \
	geom/decl_geom.js \
	numerical/decl_numerical.js \

# Manual machine setup
# See https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
# See https://github.com/nodesource/distributions
.PHONY: install.ubuntu install.npm install.brew
install.ubuntu ::
	curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
	sudo apt-get update
	sudo apt-get -y install git make python-software-properties python g++ make software-properties-common curl pwgen
	sudo apt-get -y install nodejs
	sudo apt-get -y install liblapack-dev pkg-config cmake libopenblas-dev liblapack-dev libarpack2-dev libarmadillo-dev libzmq-dev

install.brew ::
	brew install rename zopfli ffmpeg trash node tree ack hub git zmq

install.npm ::
	sudo npm install -g underscore node-gyp jshint mocha uglify-js
	sudo npm install -g hiredis redis marked websocket xmldom  eventemitter jquery jsmin2 async codemirror mori cookie scrypt

install.armadillo ::
	curl -L -O http://sourceforge.net/projects/arma/files/armadillo-7.200.2.tar.xz
	tar xf armadillo-7.200.2.tar.xz
	cd armadillo-7.200.2 && ./configure && make && sudo make install

clean ::
	rm -rf build.src

setup ::
	mkdir -p build.src

BUILD_SRC_DEPS := \
	common/MoreUnderscore.js \
	code_gen/mk_marshall.js \
	code_gen/cgen.js \
	code_gen/gen_marshall.js \
	code_gen/gen_utils.js \
	code_gen/type_registry.js \
	code_gen/ctype.js \
	code_gen/struct_ctype.js \
	code_gen/collection_ctype.js \
	code_gen/dsp_ctype.js \
	code_gen/object_ctype.js \
	code_gen/primitive_ctype.js \
	code_gen/ptr_ctype.js \
	code_gen/struct_ctype.js \
	code_gen/symbolic_math.js \
	code_gen/mk_dspmath.js \
	$(DECL_TYPES)

stage1 :: build.src/timestamp
build.src/timestamp :: $(BUILD_SRC_DEPS)
	node code_gen/mk_marshall.js $(DECL_TYPES)
	touch $@

GYP_CONFIG_DEPS := \
	Makefile \
	build.src/timestamp \
	$(wildcard $(foreach dir,$(GYP_SRCDIRS),$(dir)/*.gyp)) \
	$(wildcard $(foreach dir,$(GYP_SRCDIRS),$(dir)/*.gypi))

stage1 :: nodeif/build/Makefile
ifeq ($(GYP_MODE),Debug)
nodeif/build/Makefile : $(GYP_CONFIG_DEPS)
	cd nodeif && node-gyp configure --debug
else
nodeif/build/Makefile : $(GYP_CONFIG_DEPS)
	cd nodeif && node-gyp configure
endif


clean ::
	cd nodeif && node-gyp clean
	rm -rf nodeif/bin

build :: build.nodeif
build.nodeif :: stage1
	cd nodeif && node-gyp build --jobs 8
	mkdir -p node_modules
	cp nodeif/build/$(GYP_MODE)/ur.node node_modules/ur.node

test :: build
	env NODE_PATH=$(NODE_PATH):$(CURDIR)/nodeif/bin mocha --reporter list $(foreach dir,$(JS_SRCDIRS),$(wildcard $(dir)/test_*.js)) build.src/test_*.js


size ::
	size nodeif/build/Release/*.o

logsize ::
	node hackstats/updateSizeGraph.js nodeif/build/Release/*.o

run:
	node web/server.js doc

.PHONY: force
force :

.gitfiles : force
	git ls-files -z >$@

push.%: .gitfiles
	rsync -ai --inplace --from0 --relative --files-from .gitfiles . $*:tlbcore/.

cross.%: push.%
	ssh $* 'cd tlbcore && env NODE_PATH=/usr/lib/node_modules make'
