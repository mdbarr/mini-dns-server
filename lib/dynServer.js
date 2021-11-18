'use strict';
/**
  * Reverse Engineered Dynect API
  * https://help.dyn.com/rest/
  */

const restify = require('restify');

function DynServer (minidns) {
  const self = this;

  self.name = 'MiniDNS::DYN Server';
  self.version = minidns.config.dyn.version;
  self.host = minidns.config.dyn.host;
  self.port = minidns.config.dyn.port;

  const dynServer = restify.createServer({ name: self.name });

  self.jobs = new Map();

  function generateResponse ({
    status = 'success', data = {}, id, messages,
  }) {
    const model = {
      status,
      data,
      job_id: id || Date.now(),
      msgs: messages,
    };

    return model;
  }

  dynServer.use(restify.pre.sanitizePath());
  dynServer.use(restify.plugins.dateParser());
  dynServer.use(restify.plugins.queryParser());
  dynServer.use(restify.plugins.bodyParser());
  dynServer.use(restify.plugins.authorizationParser());

  dynServer.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST, PUT');
    res.header('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization');

    minidns.util.logger(req);
    next();
  });

  //////////
  // Session

  dynServer.post('/REST/Session', (req, res, next) => {
    const token = minidns.util.generateUniqueId(128, 'base64');
    console.log(token);
    const response = generateResponse({
      data: {
        token,
        version: self.version,
      },
      messages: [
        {
          INFO: 'login: Login successful',
          SOURCE: 'BLL',
          ERR_CD: null,
          LVL: 'INFO',
        },
      ],
    });

    res.send(200, response);
    next();
  });

  dynServer.del('/REST/Session', (req, res, next) => {
    const response = generateResponse({
      messages: [
        {
          INFO: 'logout: Logout successful',
          SOURCE: 'BLL',
          ERR_CD: null,
          LVL: 'INFO',
        },
      ],
    });

    res.send(200, response);
    next();
  });

  //////////
  // Any Record
  dynServer.get('/REST/ANYRecord/:zone/:fqdn', (req, res, next) => {
    const response = generateResponse({
      status: 'failure',
      messages: [
        {
          INFO: 'no records found',
          SOURCE: 'MINIDNS',
          ERR_CD: 'NOT_FOUND',
          LVL: 'WARN',
        },
      ],
    });

    res.send(404, response);
    next();
  });

  //////////
  // CNAME Record
  dynServer.get('/REST/CNAMERecord/:zone/:fqdn', (req, res, next) => {
    const response = generateResponse({
      status: 'failure',
      messages: [
        {
          INFO: 'no records found',
          SOURCE: 'MINIDNS',
          ERR_CD: 'NOT_FOUND',
          LVL: 'WARN',
        },
      ],
    });

    res.send(404, response);
    next();
  });

  dynServer.post('/REST/CNAMERecord/:zone/:fqdn', (req, res, next) => {
    const response = generateResponse({
      data: {
        fqdn: req.params.fqdn,
        rdata: req.body.rdata,
        record_id: '10',
        record_type: '5',
        ttl: req.body.ttl,
        zone: req.params.zone,
      },
      messages: [
        {
          INFO: 'create cname record: successful',
          SOURCE: 'MINIDNS',
          ERR_CD: null,
          LVL: 'INFO',
        },
      ],
    });

    console.json(response);

    res.send(200, response);
    next();
  });

  //////////
  // Zone
  dynServer.put('/REST/Zone/:zone', (req, res, next) => {
    const response = generateResponse({
      data: {
        task_id: '10',
        serial: '100',
        serial_style: 'increment',
        zone: req.params.zone,
        zone_type: 'Primary',
      },
      messages: [
        {
          INFO: 'zone publish: successful',
          SOURCE: 'MINIDNS',
          ERR_CD: null,
          LVL: 'INFO',
        },
      ],
    });

    res.send(200, response);
    next();
  });

  //////////

  dynServer.placeHolder = function(req, res, next) {
    console.log('%s: %s %s', minidns.util.colorize('cyan', 'UNIMPLEMENTED ENDPOINT'),
      req.method, req.url);

    res.send(200, { message: 'placeholder' });
    next();
  };

  dynServer.get(/.*/, dynServer.placeHolder);
  dynServer.post(/.*/, dynServer.placeHolder);
  dynServer.put(/.*/, dynServer.placeHolder);
  dynServer.head(/.*/, dynServer.placeHolder);
  dynServer.del(/.*/, dynServer.placeHolder);

  //////////

  self.boot = function() {
    dynServer.listen(self.port, self.host, () => {
      console.log('%s listening at %s', dynServer.name, dynServer.url);
    });
  };

  //////////

  return self;
}

module.exports = function(minidns) {
  return new DynServer(minidns);
};
