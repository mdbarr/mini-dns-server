'use strict';

const defaults = require('./defaults');

function MiniDns (options = {}) {
  this.utils = require('./utils');
  this.config = Object.assign(defaults, options);

  this.models = require('./models')(this);
  this.dns = require('./dnsServer')(this);
  this.resolver = require('./resolver')(this);
  this.store = require('./datastore')(this);

  const services = [ this.dns ];

  if (this.config.api.enabled) {
    this.api = require('./apiServer')(this);
    services.push(this.api);
  }

  if (this.config.dyn.enabled) {
    this.dyn = require('./dynServer')(this);
    services.push(this.dyn);
  }

  this.boot = () => {
    for (const service of services) {
      service.boot();
    }
  };
}

module.exports = MiniDns;
