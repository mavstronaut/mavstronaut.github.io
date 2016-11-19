'use strict';
var _                   = require('underscore');
var async               = require('async');
var path                = require('path');
var fs                  = require('fs');
var url                 = require('url');
var querystring         = require('querystring');
var https               = require('https');
var cookie              = require('cookie');
var logio               = require('./logio');
var Safety              = require('./Safety');
var Auth                = require('./Auth');
var Provider            = require('./Provider');

exports.OAuthProvider = OAuthProvider;
exports.getHttpRequestAccessToken = getHttpRequestAccessToken;

function getHttpRequestAccessToken(req) {
  var headers = req.headers;
  if (headers.cookie) {
    var cookies = cookie.parse(headers.cookie);
    if (cookies) {
      var accessToken = cookies['access_token'];
      if (accessToken) {
        var accessTokenParts = accessToken.split(' ');
        if (!_.every(accessTokenParts, Safety.isValidToken)) {
          logio.E(req.connection.remoteAddress, 'Invalid access_token cookie:', accessToken);
          return null;
        }
        return accessTokenParts;
      }
    }
  }
  return null;
}

/* ----------------------------------------------------------------------

   OAuthProvider. Meant to be generic, but currently probably has some assumptions from Github baked in.

   Spec at https://developer.github.com/v3/oauth/

*/

function OAuthProvider(oauthUrl, clientId, clientSecret, scopes) {
  this.oauthUrl = oauthUrl;
  this.oauthUrlParsed = url.parse(this.oauthUrl);
  this.clientId = clientId;
  this.clientSecret = clientSecret;
  this.scopes = scopes;

  // This needs to be shared among multiple webservers eventually
  this.codesCache = {};
  Provider.AnyProvider.call(this);
}
OAuthProvider.prototype = Object.create(Provider.AnyProvider.prototype);

OAuthProvider.prototype.isDir = function() { return true; };


/*
  Test at:
  http://192.168.1.6:8000/yoga/oauth/login?redirect_url=http%3A%2F%2F192.168.1.6%3A8000%2Fyoga%2F%23scope_foo20
  http://127.0.0.1:8000/yoga/oauth/login?redirect_url=http%3A%2F%2F127.0.0.1%3A8000%2Fyoga%2F%23scope_foo20
  http://studio-alpha.umbrellaresearch.com/oauth/login?redirect_url=http%3A%2F%2Fstudio-alpha.umbrellaresearch.com%2F%23scope_foo20
*/

OAuthProvider.prototype.handleRequest = function(req, res, suffix) {
  var self = this;

  var remote = res.connection.remoteAddress + '!http';

  var up = req.urlParsed;

  if (suffix === 'login') {

    var appRedirectUrl = up.query['redirect_url'];

    var callbackUrl = up.protocol + '//' + up.host + path.dirname(up.pathname) + '/callback';

    var stateCookie = Auth.generateCookie();
    self.codesCache[stateCookie] = {
      redirectUrl: appRedirectUrl
    };
    var location = self.oauthUrl + 'authorize?' + querystring.stringify({
      'client_id': self.clientId,
      'redirect_url': callbackUrl,
      'scope': self.scopes.join(','),
      'state': stateCookie
    });
    logio.O(remote, 'Redirect to', location);
    res.writeHead(302, {
      'Location': location
    });
    res.end();
    return;
  }
  else if (suffix === 'callback') {
    var authCode = up.query['code'];
    var stateCookie = up.query['state'];
    var codeInfo = self.codesCache[stateCookie];

    if (codeInfo && codeInfo.redirectUrl) {
      self.getAccessToken(authCode, up, function(err, accessTokenInfo) {
        logio.O(remote, 'Cookie access_token', 'github ' + accessTokenInfo['access_token']);
        res.writeHead(302, {
          'Set-Cookie': cookie.serialize('access_token', 'github ' + accessTokenInfo['access_token'], {
            path: '/',
            maxAge: 30*86400,
            httpOnly: false,
            secure: (up.protocol === 'https:')
          }),
          'Location': codeInfo.redirectUrl,
        });
        res.end();
      });

    }
    else {
      logio.E(remote, 'No auth code in args', up.query);
      Provider.emit404(res, 'No auth code found');
    }
  }
  else if (suffix === 'logout') {
    var appRedirectUrl = up.query['redirect_url'];
    res.writeHead(302, {
      'Set-Cookie': cookie.serialize('access_token', '', {
        path: '/',
        maxAge: 0,
        httpOnly: false,
        secure: (up.protocol === 'https:')
      }),
      'Location': appRedirectUrl
    });
    res.end();
  }
  else {
    logio.E(remote, 'Unknown suffix', suffix);
  }
};

OAuthProvider.prototype.getAccessToken = function(authCode, up, cb) {
  var self = this;

  var accessTokenArgs = {
    hostname: self.oauthUrlParsed.hostname,
    port: 443,
    method: 'POST',
    path: self.oauthUrlParsed.path + 'access_token',
  };
  var remote = 'https://' + accessTokenArgs.hostname + accessTokenArgs.path;
  logio.O(remote, 'POST');

  var postReq = https.request(accessTokenArgs, function(res) {
    var datas = [];
    res.on('data', function(d) {
      datas.push(d);
    });
    res.on('end', function() {
      var data = datas.join('');
      var accessTokenInfo = querystring.parse(data);
      logio.I(remote, accessTokenInfo);
      if (cb) {
        cb(null, accessTokenInfo);
        cb = null;
      }
    });
    res.on('err', function(err) {
      cb(err, null);
      cb = null;
    });
  });
  postReq.write(querystring.stringify({
    'client_id': self.clientId,
    'client_secret': self.clientSecret,
    'code': authCode,
    'redirect_url': up.protocol + '//' + up.host + up.pathname
  }));
  postReq.end();
};

OAuthProvider.prototype.toString = function() {
  return 'OAuthProvider(' + this.oauthUrl + ', ' + this.clientId + ', ..., [' + this.scopes.join(',') + '])';
};
