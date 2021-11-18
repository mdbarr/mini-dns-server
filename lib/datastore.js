'use strict';

function Zone ({
  name, serial = 0, ttl = 300, serialStyle = 'increment', zoneType = 'Primary',
  A = [], AAAA = [], CNAME = [], MX = [], PTR = [], SOA = [], SRV = [], TXT = [],
  resolver,
}) {
  this.name = name;
  this.serial = serial;
  this.serialStyle = serialStyle;
  this.zoneType = zoneType;
  this.ttl = ttl;

  this.records = {};

  this.pending = {
    A: new Map(A),
    AAAA: new Map(AAAA),
    CNAME: new Map(CNAME),
    MX: new Map(MX),
    PTR: new Map(PTR),
    SOA: new Map(SOA),
    SRV: new Map(SRV),
    TXT: new Map(TXT),
  };

  this.resolver = resolver;
}

Zone.prototype.update = function() {
  const self = this;
  self.serial++;
  self.pending.SOA.forEach((value) => {
    value.serial = self.serial;
  });
};

Zone.prototype.publish = function() {
  this.update();

  for (const type in this.pending) {
    this.records[type] = new Map(this.pending[type]);
  }
};

Zone.prototype.has = function(type, key) {
  type = (type || '').toUpperCase();
  if (this.records[type]) {
    return this.records[type].has(key);
  }
  return false;
};

Zone.prototype.set = function(type, key, value, immediate = true) {
  type = (type || '').toUpperCase();
  if (this.records[type]) {
    this.pending[type].set(key, value);
    if (immediate) {
      this.records[type].set(key, value);
      this.update();
    }
    return true;
  }
  return false;
};

Zone.prototype.delete = function(type, key, immediate = true) {
  type = (type || '').toUpperCase();
  if (this.records[type] && this.records[type].has(key)) {
    this.pending[type].delete(key);
    if (immediate) {
      this.records[type].delete(key);
      this.update();
    }
    return true;
  }
  return false;
};

function Datastore (minidns) {
  const self = this;

  const store = {
    prefix: minidns.util.generateAlphaNumeric(6),
    zones: {},
    counter: 0,
  };

  self.generateId = function(length) {
    const id = (store.counter++).toString(16);
    return `${ store.prefix }${ '0'.repeat(length - (id.length + store.prefix.length)) }${ id }`;
  };

  self.zone = function(name) {
    return store.zones[name];
  };

  self.zone.exists = function(name) {
    return Boolean(store.zones[name]);
  };

  self.zone.find = function(zone, type, name) {
    if (self.zone.exists(zone)) {
      return store.zones[zone].records[type].get(name);
    }
    return null;
  };

  self.zone.resolver = function(zone) {
    if (self.zone.exists(zone)) {
      return store.zones[zone].resolver;
    }
    return self.defaultResolver;
  };

  self.zone.ttl = function(zone) {
    if (self.zone.exists(zone)) {
      return store.zones[zone].ttl;
    }
    return minidns.config.options.defaultTTL;
  };

  self.zone.create = function(zone) {
    store.zones[zone.name] = new Zone(zone);
    store.zones[zone.name].publish();
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
