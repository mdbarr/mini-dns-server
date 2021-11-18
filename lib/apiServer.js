'use strict';

const restify = require('restify');

function ApiServer (minidns) {
  this.name = 'MiniDNS::API Server';
  this.host = minidns.config.api.host;
  this.port = minidns.config.api.port;

  const apiServer = restify.createServer({ name: this.name });

  apiServer.use(restify.pre.sanitizePath());
  apiServer.use(restify.plugins.dateParser());
  apiServer.use(restify.plugins.queryParser());
  apiServer.use(restify.plugins.bodyParser());
  apiServer.use(restify.plugins.authorizationParser());

  //////////

  this.boot = () => {
    apiServer.listen(this.port, this.host, () => {
      console.log('%s listening at %s', apiServer.name, apiServer.url);
    });
  };

  //////////
}

module.exports = (minidns) => new ApiServer(minidns);
