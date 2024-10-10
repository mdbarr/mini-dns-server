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

  this.update = () => {
    this.serial++;
    this.pending.SOA.forEach((value) => {
      value.serial = this.serial;
    });
  };

  this.publish = () => {
    this.update();

    for (const type in this.pending) {
      if (Object.hasOwn(this.pending, type)) {
        this.records[type] = new Map(this.pending[type]);
      }
    }
  };

  this.has = (type, key) => {
    type = (type || '').toUpperCase();
    if (this.records[type]) {
      return this.records[type].has(key);
    }
    return false;
  };

  this.set = (type, key, value, immediate = true) => {
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

  this.delete = (type, key, immediate = true) => {
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
}

function Datastore (minidns) {
  const store = {
    prefix: minidns.util.generateAlphaNumeric(6),
    zones: {},
    counter: 0,
  };

  this.generateId = (length) => {
    const id = (store.counter++).toString(16);
    return `${ store.prefix }${ '0'.repeat(length - (id.length + store.prefix.length)) }${ id }`;
  };

  this.zone = (name) => store.zones[name];

  this.zone.exists = (name) => Boolean(store.zones[name]);

  this.zone.find = (zone, type, name) => {
    if (this.zone.exists(zone) && store.zones[zone]?.records[type]?.has(name)) {
      return store.zones[zone]?.records[type]?.get(name);
    }
    return null;
  };

  this.zone.resolver = (zone) => {
    if (this.zone.exists(zone)) {
      return store.zones[zone].resolver;
    }
    return this.defaultResolver;
  };

  this.zone.ttl = (zone) => {
    if (this.zone.exists(zone)) {
      return store.zones[zone].ttl;
    }
    return minidns.config.options.defaultTTL;
  };

  this.zone.create = (zone) => {
    store.zones[zone.name] = new Zone(zone);
    store.zones[zone.name].publish();
  };

  //////////

  if (minidns.config.dns.zones) {
    for (const name in minidns.config.dns.zones) {
      if (Object.hasOwn(minidns.config.dns.zones, name)) {
        const zone = minidns.config.dns.zones[name];

        if (zone.nameservers && zone.nameservers.length) {
          zone.resolver = minidns.resolver.createResolver(zone.name, zone.nameservers);
        } else {
          zone.resolver = minidns.resolver.defaultResolver;
        }

        this.zone.create(zone);
      }
    }
  }
}

module.exports = (minidns) => new Datastore(minidns);
