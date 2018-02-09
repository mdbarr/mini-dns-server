'use strict';

const dns = require('dns');

function Resolver(minidns) {
  const self = this;

  self.resolverCache = { };

  self.createResolver = function(name, nameservers) {
    if (!Array.isArray(nameservers)) {
      nameservers = [ nameservers ];
    }

    const resolver = self.resolverCache[name] || new dns.Resolver();
    resolver.setServers(nameservers);

    self.resolverCache[name] = resolver;
    return resolver;
  };

  self.resolver = self.createResolver('default', minidns.config.dns.nameservers);

  return self;
}

module.exports = function(minidns) {
  return new Resolver(minidns);
};
