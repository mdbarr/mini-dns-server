'use strict';

const { version } = require('../package.json');

const defaults = {
  version,
  options: {
    allowDynamicZoneCreation: true,
    defaultTTL: 300,
    forwardZoneUnknowns: true,
    maxDepth: 10,
    silent: false,
  },
  // DNS Server config
  dns: {
    port: 53,
    host: '127.0.0.1',
    // Default nameservers
    nameservers: [
      '8.8.8.8',
      '8.8.4.4',
    ],
    retries: 4,
    timeout: 500,
    // RFC-6761 reserves four TLDs for special use:
    //   .example, .invalid, .localhost, and .test
    zones: {
      test: {
        name: 'test',
        users: [ 'system', 'minidns' ],
        SOA: [
          [
            'test', {
              name: 'test',
              primary: 'ns.test',
              admin: 'dns-admin.test',
              refresh: 900,
              retry: 900,
              minimum: 60,
              serial: 0,
              expiration: 1800,
            },
          ],
        ],
        A: [ [ 'localhost', { address: '127.0.0.1' } ] ],
        AAAA: [ [ 'localhost', { address: '::1' } ] ],
        CNAME: [ [ 'local', { data: 'localhost.test' } ] ],
        MX: [
          [
            'test', {
              priority: 10,
              exchange: 'mx.test',
            },
          ],
        ],
        TXT: [ [ 'test', { data: [ `v=mini-dns-server v${ version }` ] } ] ],
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
