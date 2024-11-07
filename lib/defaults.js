'use strict';

const { version } = require('../package.json');

const defaults = {
  version,
  options: {
    allowDynamicZoneCreation: true,
    defaultTTL: 300,
    maxDepth: 10,
    silent: true,
  },
  // DNS Server config
  dns: {
    port: 53,
    host: '127.0.0.1',
    // Default nameservers
    nameservers: [ '10.110.0.2' ],
    retries: 4,
    timeout: 500,
    // RFC-6761 reserves four TLDs for special use:
    //   .example, .invalid, .localhost, and .test
    zones: {
      onshape: {
        name: 'ops.onshape.com',
        authoritative: false,
        CNAME: [ [ 'logs-usw2', { data: 'vpc-infra-us-west-2-kl33kqxccxyt6qg2g3c2py32ri.us-west-2.es.amazonaws.com' } ] ],
      },
    },
  },
  // API Server config
  api: {
    enabled: false,
    requireAuthorization: true,
    version,
    host: '0.0.0.0',
    port: 5354,
    customer: 'system',
    key: 'mini-dns-8dj38#A65*5jdsP',
  },
  dyn: {
    enabled: false,
    requireAuthorization: true,
    version: '3.0.0',
    host: '0.0.0.0',
    port: 5353,
    hostsFileSync: true,
    customers: [
      {
        customer: 'minidns',
        username: 'user',
        password: 'password',
        zones: [ 'test' ],
      },
    ],
  },
};

module.exports = defaults;
