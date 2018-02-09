#!/usr/bin/env node
'use strict';

const defaults = {
  // DNS Server config
  dns: {
    port: 53,
    host: '0.0.0.0',
    // Default nameservers
    nameservers: [
      '8.8.8.8',
      '8.8.4.4'
    ],
    // Domain specific nameservers
    servers: {},
    // Domain specific answers
    domains: {
      'dev': 'A:127.0.0.1'
    },
    // Host specific answers (alias)
    hosts: {
      'devlocal': 'A:127.0.0.1'
    }
  },
  // API Server config
  api: {
    enabled: true,
    host: '0.0.0.0',
    port: 6160,
    key: 'dns-proxy-t7w!184$A6*55WI'
  },
  dyn: {
    enabled: true,
    requireAuthorization: true,
    version: '3.0.0',
    host: '0.0.0.0',
    port: 6161,
    hostsFileSync: true,
    customers: [
      'default': {
        username: 'default',
        password: 'default',
        zones: [
          'dev'
        ]
      }
    ]
  }
};

function MiniDns(options = {}) {
  const minidns = this;

  minidns.config = Object.assign(defaults, options);
  minidns.store = require('./lib/datastore')(minidns);
  minidns.util = require('./lib/util');
  minidns.resolver = require('./lib/resolver')(minidns);

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
