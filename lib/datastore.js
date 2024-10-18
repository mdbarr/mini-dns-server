'use strict';

const Zone = require('./zone');

function Datastore (minidns) {
  const store = {
    prefix: minidns.utils.generateAlphaNumeric(6),
    zones: {},
    counter: 0,
  };

  this.generateId = (length) => {
    const id = (store.counter++).toString(16);
    return `${ store.prefix }${ '0'.repeat(length - (id.length + store.prefix.length)) }${ id }`;
  };

  this.zone = (name) => store.zones[name];

  this.zone.exists = (name) => Object.hasOwn(store.zones, name);

  this.zone.resolve = (zone, name, kind, type, fqdn) => {
    if (this.zone.exists(zone) && store.zones[zone].has(type, name)) {
      return store.zones[zone].resolve(name, kind, type, fqdn);
    }
    return [];
  };

  this.zone.authority = (zone) => {
    if (this.zone.exists(zone) && this.zone(zone).authoritative) {
      return this.zone(zone).authority();
    }
    return [];
  };

  this.zone.ttl = (zone) => {
    if (this.zone.exists(zone)) {
      return store.zones[zone].defaultTTL;
    }
    return minidns.config.options.defaultTTL;
  };

  this.zone.create = (name, data) => {
    const zone = new Zone(minidns, name, data);
    store.zones[zone.name] = zone;
    store.zones[zone.name].publish();
  };

  this.zone.shouldForward = (zone) => this.zone.exists(zone) && this.zone(zone).forwarding;

  this.zone.nameservers = (zone) => {
    if (this.zone.exists(zone) && Array.isArray(this.zone(zone).nameservers)) {
      return this.zone(zone).nameservers;
    } else if (Array.isArray(minidns.config.dns.nameservers)) {
      return minidns.config.dns.nameservers;
    }
    return [ '8.8.8.8' ];
  };

  //////////

  if (minidns.config.dns.zones) {
    for (const name in minidns.config.dns.zones) {
      if (Object.hasOwn(minidns.config.dns.zones, name)) {
        const zone = minidns.config.dns.zones[name];
        this.zone.create(name, zone);
      }
    }
  }
}

module.exports = (minidns) => new Datastore(minidns);
