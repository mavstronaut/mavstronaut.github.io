var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var crypto              = require('crypto');
var cgen                = require('./cgen');
var gen_utils           = require('./gen_utils');

exports.CType = CType;

function CType(reg, typename) {
  var type = this;
  assert.ok(typename);
  type.reg = reg;
  type.typename = typename;
  type.jsTypename = typename.replace(/>+$/g, '').replace(/</g, '_').replace(/>/g, '_').replace(/,/g,'_').replace(/::/g,'_');

  type.extraFunctionDecls = [];
  type.extraMemberDecls = [];
  type.extraConstructorArgs = [];
  type.extraHostCode = [];
  type.extraDeclDependencies = [];
  type.extraDefnDependencies = [];
  type.extraJsWrapHeaderIncludes = [];
  type.extraHeaderIncludes = [];
  type.extraConstructorCode = [];
  type.extraDestructorCode = [];
  type.extraJswrapMethods = [];
  type.extraJswrapAccessors = [];
}

CType.prototype.addFunctionDecl = function(x) { this.extraFunctionDecls.push(x); };
CType.prototype.addMemberDecl = function(x) { this.extraMemberDecls.push(x); };
CType.prototype.addConstructorArg = function(x) { this.extraConstructorArgs.push(x); };
CType.prototype.addHostCode = function(x) { this.extraHostCode.push(x); };
CType.prototype.addDeclDependency = function(x) { this.extraDeclDependencies.push(x); };
CType.prototype.addJsWrapHeaderInclude = function(x) { this.extraJsWrapHeaderIncludes.push(x); };
CType.prototype.addHeaderInclude = function(x) { this.extraHeaderIncludes.push(x); };
CType.prototype.addConstructorCode = function(x) { this.extraConstructorCode.push(x); };
CType.prototype.addDestructorCode = function(x) { this.extraDestructorCode.push(x); };
CType.prototype.addJswrapMethod = function(x) { this.extraJswrapMethods.push(x); };
CType.prototype.addJswrapAccessor = function(x) { this.extraJswrapAccessors.push(x); };

CType.prototype.isStruct = function() { return false; };
CType.prototype.isObject = function() { return false; };
CType.prototype.isCollection = function() { return false; };
CType.prototype.isPrimitive = function() { return false; };
CType.prototype.isObject = function() { return false; };
CType.prototype.isPtr = function() { return false; };
CType.prototype.isDsp = function() { return false; };
CType.prototype.isPod = function() { return false; };
CType.prototype.isCopyConstructable = function() { return true; };
CType.prototype.hasArrayNature = function() { return false; };
CType.prototype.hasJsWrapper = function() { return false; };

CType.prototype.nonPtrType = function() {
  return this;
};

CType.prototype.getConstructorArgs = function() {
  return this.extraConstructorArgs;
};

CType.prototype.getSchema = function() {
  return {typename: this.jsTypename, hasArrayNature: this.hasArrayNature(), members: this.getMembers()};
};

CType.prototype.getCppToJsExpr = function(valueExpr, parentExpr, ownerExpr) {
  var type = this;
  throw new Error('no ValueNew for ' + type.typename);
};


CType.prototype.getMembers = function() {
  return [];
};

CType.prototype.getFnBase = function() {
  return this.jsTypename;
};

CType.prototype.getFns = function() {
  var type = this;
  var base = type.getFnBase();
  return {
    hostCode: type.noHostCode ? undefined : base + '_host.cc',
    jsTestCode: 'test_' + base + '.js',
    typeHeader: type.noHostCode ? undefined : base + '_decl.h',
    jsWrapHeader: base + '_jsWrap.h',
    jsWrapCode: base + '_jsWrap.cc',
    rosCode: base + '_ros.h',
  };
};

CType.prototype.emitAll = function(files) {
  var type = this;
  var fns = type.getFns();
  if (0) console.log('emitAll', type.typename, fns);
  if (fns.hostCode) {
    type.emitHostCode(files.getFile(fns.hostCode).child({TYPENAME: type.typename}));
  }
  if (fns.typeHeader) {
    type.emitHeader(files.getFile(fns.typeHeader).child({TYPENAME: type.typename}));
  }
  if (fns.jsWrapHeader) {
    type.emitJsWrapHeader(files.getFile(fns.jsWrapHeader).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}));
  }
  if (fns.jsWrapCode) {
    type.emitJsWrapCode(gen_utils.withJsWrapUtils(files.getFile(fns.jsWrapCode).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}), type.reg));
  }
  if (fns.rosCode) {
    type.emitRosCode(files.getFile(fns.rosCode).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}));
  }
};


CType.prototype.getCustomerIncludes = function() {
  var type = this;
  var base = type.getFnBase();
  return ['#include "' + base + '_decl.h"'];
};

CType.prototype.getHeaderIncludes = function() {
  var type = this;
  var ret = [];
  _.each(type.getDeclDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      ret.push('#include "' + fns.typeHeader + '"');
    }
  });
  _.each(type.extraHeaderIncludes, function(hdr) {
    if (/^</.test(hdr)) {
      ret.push('#include ' + hdr + '');
    } else {
      ret.push('#include "' + hdr + '"');
    }
  });
  return ret;
};

CType.prototype.getSignature = function() {
  var type = this;
  var syn = type.getSynopsis();
  var h = crypto.createHash('sha1');
  h.update(syn);
  return h.digest('base64').substr(0, 8);
};

CType.prototype.getTypeAndVersion = function() {
  var type = this;
  return type.typename + '@' + type.getSignature();
};


/*
  Defn Dependencies:
*/

CType.prototype.addDefnDependency = function(x) {
  var type = this;
  type.extraDefnDependencies.push(x);
};

CType.prototype.getDefnDependencies = function() {
  var type = this;
  return gen_utils.sortTypes(type.extraDefnDependencies);
};

CType.prototype.getAllTypes = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(gen_utils.nonPtrTypes(_.flatten(_.map(type.getMemberTypes(), function(t) { return [t].concat(t.getAllTypes()); }))));
  if (0) console.log('CType.getAllTypes', type.typename, _.map(subtypes, function(type) { return type.typename; }));

  return subtypes;
};

CType.prototype.getDeclDependencies = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(type.getAllTypes().concat(type.extraDeclDependencies));
  if (0) console.log('CType.getDeclDependencies', type.typename, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

CType.prototype.addDeclDependency = function(t) {
  var type = this;
  assert.ok(t);
  type.extraDeclDependencies.push(t);
};

CType.prototype.getMemberTypes = function() {
  return [];
};

CType.prototype.getRecursiveMembers = function() {
  var type = this;
  var acc = {};
  type.accumulateRecursiveMembers([], acc);
  return acc;
};

CType.prototype.accumulateRecursiveMembers = function(context, acc) {
  var type = this;
  if (!acc[type.typename]) {
    acc[type.typename] = [];
  }
  acc[type.typename].push(context);
}

CType.prototype.refRecursiveMember = function(context) {
  var type = this;
};


// ----------------------------------------------------------------------

CType.prototype.emitHeader = function(f) {
  var type = this;
  f('#include "common/jsonio.h"');
  type.emitForwardDecl(f);
  _.each(type.getHeaderIncludes(), function(l) {
    f(l);
  });
  type.emitTypeDecl(f);
  type.emitFunctionDecl(f);
};

CType.prototype.emitHostCode = function(f) {
  var type = this;
  f('#include "common/std_headers.h"');
  var fns = type.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  _.each(type.getDefnDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f('#include "' + fns.typeHeader + '"');
    }
  });
  f('');
  type.emitHostImpl(f);
  _.each(type.extraHostCode, function(l) {
    f(l);
  });
};

CType.prototype.emitJsWrapHeader = function(f) {
  var type = this;
  _.each(type.getDeclDependencies().concat([type]), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f('#include "' + fns.typeHeader + '"');
    }
  });
  _.each(type.extraJsWrapHeaderIncludes, function(include) {
    f('#include "' + include + '"');
  });

  type.emitJsWrapDecl(f);
};

CType.prototype.emitJsWrapCode = function(f) {
  var type = this;
  f('#include "common/std_headers.h"');
  f('#include "nodebase/jswrapbase.h"');
  var fns = type.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  if (fns.jsWrapHeader) {
    f('#include "' + fns.jsWrapHeader + '"');
  }
  f('/* declDependencies = ' + _.map(type.getDeclDependencies(), function(ot) { return ot.typename; }) + ' */');
  _.each(type.getDeclDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.jsWrapHeader) {
      f('#include "' + fns.jsWrapHeader + '"');
    }
  });
  f('#include "' + type.getFns().jsWrapHeader + '"');
  f('#include "vec_jsWrap.h"');
  f('#include "build.src/map_string_jsonstr_jsWrap.h"');
  f('');
  type.emitJsWrapImpl(f);
};

CType.prototype.emitRosCode = function(f) {
  var type = this;
  f('#include <ros/ros.h>');
  f('namespace ros {');
  f('namespace serialization {');

  f('template<> struct Serializer<TYPENAME> {');

  f('template<typename Stream> inline static void write(Stream &stream, TYPENAME const &t) {')
  f('jsonstr json;');
  f('json.useBlobs();');
  f('toJson(json, t);');
  f('stream.next(json.it);');
  f('size_t partCount = json.blobs->partCount();');
  f('stream.next((uint32_t)partCount);');
  f('for (size_t i=1; i < partCount; i++) {');
  f('auto part = s.blobs->getPart(i);');
  f('stream.next((uint32_t)part.second);');
  f('memcpy(stream.advance((uint32_t)part.second), (void *)part.first, part.second);');
  f('}');
  f('}');

  f('template<typename Stream> inline static void read(Stream &stream, TYPENAME &t) {')
  f('jsonstr json;');
  f('stream.next(json.it);');
  f('uint32_t partCount = 0;');
  f('stream.next(partCount);');
  f('if (partCount > 1) json.useBlobs();');
  f('for (size_t i=1; i < partCount; i++) {');
  f('uint32_t partSize = 0;');
  f('stream.next(partSize);');
  f('json.blobs->addExternalPart(stream.advance(partSize), partSize);');
  f('}');
  f('if (!fromJson(json, t)) throw new runtime_error("deserializing TYPENAME: fromJson failed");');
  f('}');

  f('inline static uint32_t serializedLength(TYPENAME const &t) {')
  f('size_t size = 0;');
  f('wrJsonSize(size, nullptr, t);');
  f('return (uint32_t)size;');
  f('}');


  f('};');

  f('}'); // namespace serialization
  f('}'); // namespace ros
}

CType.prototype.emitJsTestImpl = function(f) {
};

// ----------------------------------------------------------------------


CType.prototype.emitForwardDecl = function(f) {
};

CType.prototype.emitTypeDecl = function(f) {
};

CType.prototype.emitFunctionDecl = function(f) {
  var type = this;
  _.each(type.extraFunctionDecls, function(l) {
    f(l);
  });
};

CType.prototype.emitHostImpl = function(f) {
};

CType.prototype.emitJsWrapDecl = function(f) {
};

CType.prototype.emitJsWrapImpl = function(f) {
};

CType.prototype.getVarDecl = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

CType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

CType.prototype.getInitializer = function() {
  return this.getAllZeroExpr();
};
