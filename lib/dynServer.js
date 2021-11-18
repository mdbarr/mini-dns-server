'use strict';
/**
  * Reverse Engineered Dynect API
  * https://help.dyn.com/rest/
  */

const restify = require('restify');

function DynServer (minidns) {
  this.name = 'MiniDNS::DYN Server';
  this.version = minidns.config.dyn.version;
  this.host = minidns.config.dyn.host;
  this.port = minidns.config.dyn.port;

  const dynServer = restify.createServer({ name: this.name });

  this.jobs = new Map();

  function generateResponse ({
    status = 'success', data = {}, id, messages,
  }) {
    const model = {
      status,
      data,
      'job_id': id || Date.now(),
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
    return next();
  });

  //////////
  // Session

  dynServer.post('/REST/Session', (req, res, next) => {
    const token = minidns.util.generateUniqueId(128, 'base64');
    console.log(token);
    const response = generateResponse({
      data: {
        token,
        version: this.version,
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
    return next();
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
    return next();
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
    return next();
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
    return next();
  });

  dynServer.post('/REST/CNAMERecord/:zone/:fqdn', (req, res, next) => {
    const response = generateResponse({
      data: {
        fqdn: req.params.fqdn,
        rdata: req.body.rdata,
        'record_id': '10',
        'record_type': '5',
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
    return next();
  });

  //////////
  // Zone
  dynServer.put('/REST/Zone/:zone', (req, res, next) => {
    const response = generateResponse({
      data: {
        'task_id': '10',
        serial: '100',
        'serial_style': 'increment',
        zone: req.params.zone,
        'zone_type': 'Primary',
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
    return next();
  });

  //////////

  dynServer.placeHolder = (req, res, next) => {
    console.log('%s: %s %s', minidns.util.colorize('cyan', 'UNIMPLEMENTED ENDPOINT'),
      req.method, req.url);

    res.send(200, { message: 'placeholder' });
    return next();
  };

  dynServer.get('*', dynServer.placeHolder);
  dynServer.post('*', dynServer.placeHolder);
  dynServer.put('*', dynServer.placeHolder);
  dynServer.head('*', dynServer.placeHolder);
  dynServer.del('*', dynServer.placeHolder);

  //////////

  this.boot = () => {
    dynServer.listen(this.port, this.host, () => {
      console.log('%s listening at %s', dynServer.name, dynServer.url);
    });
  };

  //////////
}

module.exports = (minidns) => new DynServer(minidns);
