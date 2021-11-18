#!/usr/bin/env node
'use strict';

const version = require('./package.json').version;

const defaults = {
  options: {
    allowDynamicZoneCreation: true,
    defaultTTL: 300,
    forwardZoneUnknowns: true,
    silent: false,
  },
  // DNS Server config
  dns: {
    port: 53,
    host: '127.0.0.1', // '0.0.0.0',
    // Default nameservers
    nameservers: [
      '8.8.8.8',
      '8.8.4.4',
    ],
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
    enabled: true,
    requireAuthorization: true,
    version,
    host: '0.0.0.0',
    port: 5354,
    customer: 'system',
    key: 'mini-dns-8dj38#A65*5jdsP',
  },
  dyn: {
    enabled: true,
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

function MiniDns (options = {}) {
  const minidns = this;

  minidns.util = require('./lib/util');
  minidns.config = Object.assign(defaults, options);

  minidns.resolver = require('./lib/resolver')(minidns);
  minidns.store = require('./lib/datastore')(minidns);

  minidns.dns = require('./lib/dnsServer')(minidns);
  minidns.api = require('./lib/apiServer')(minidns);
  minidns.dyn = require('./lib/dynServer')(minidns);

  minidns.boot = function() {
    minidns.dns.boot();
    minidns.api.boot();
    minidns.dyn.boot();
  };

  return minidns;
}

const minidns = new MiniDns();
minidns.boot();
