'use strict';

function Zone({
  name, serial = 0, ttl = 300, serialStyle = 'increment', zoneType = 'Primary',
  A = [], AAAA = [], CNAME = [], MX = [], PTR = [], SRV = [], TXT = [],
  resolver
}) {
  this.name = name;
  this.serial = serial;
  this.serialStyle = serialStyle;
  this.zoneType = zoneType;
  this.ttl = ttl;

  this.A = new Map(A);
  this.AAAA = new Map(AAAA);
  this.CNAME = new Map(CNAME);
  this.MX = new Map(MX);
  this.PTR = new Map(PTR);
  this.SRV = new Map(SRV);
  this.TXT = new Map(TXT);

  this.resolver = resolver;
};

Zone.prototype.add = function(type, key, value) {
  type = (type || '').toUpperCase();
  if (this[type]) {
    this[type].set(key, value);
    return true;
  } else {
    return false;
  }
};

function Datastore(minidns) {
  const self = this;

  const store = {
    prefix: minidns.util.generateAlphaNumeric(6),
    zones: {},
    counter: 0
  };

  self.generateId = function(length) {
    const id = (store.counter++).toString(16);
    return `${ store.prefix }${ '0'.repeat(length - (id.length + store.prefix.length)) }${ id }`;
  };

  self.zone = function(name) {
    return store.zones[name];
  };

  self.zone.exists = function(name) {
    return !!store.zones[name];
  };

  self.zone.find = function(zone, type, name) {
    if (self.zone.exists(zone)) {
      return store.zones[zone][type].get(name);
    } else {
      return null;
    }
  };

  self.zone.resolver = function(zone) {
    if (self.zone.exists(zone)) {
      return store.zones[zone].resolver;
    } else {
      return self.defaultResolver;
    }
  };

  self.zone.ttl = function(zone) {
    if (self.zone.exists(zone)) {
      return store.zones[zone].ttl;
    } else {
      return minidns.config.options.defaultTTL;
    }
  };

  self.zone.create = function(zone) {
    store.zones[zone.name] = new Zone(zone);
  };

  //////////

  if (minidns.config.dns.zones) {
    for (const name in minidns.config.dns.zones) {
      const zone = minidns.config.dns.zones[name];

      if (zone.nameservers && zone.nameservers.length) {
        zone.resolver = minidns.resolver.createResolver(zone.name, zone.nameservers);
      } else {
        zone.resolver = minidns.resolver.defaultResolver;
      }

      self.zone.create(zone);
    }
  }

  //////////

  return self;
}

module.exports = function(minidns) {
  return new Datastore(minidns);
};
