'use strict';

const restify = require('restify');

function ApiServer(minidns) {
  const self = this;

  self.name = 'MiniDNS::API Server';
  self.host = minidns.config.api.host;
  self.port = minidns.config.api.port;

  const apiServer = restify.createServer({
    name: self.name
  });

  apiServer.use(restify.pre.sanitizePath());
  apiServer.use(restify.plugins.dateParser());
  apiServer.use(restify.plugins.queryParser());
  apiServer.use(restify.plugins.bodyParser());
  apiServer.use(restify.plugins.authorizationParser());

  //////////

  self.boot = function() {
    apiServer.listen(self.port, self.host, function () {
      console.log('%s listening at %s', apiServer.name, apiServer.url);
    });
  };

  //////////

  return self;
}

module.exports = function(minidns) {
  return new ApiServer(minidns);
};
