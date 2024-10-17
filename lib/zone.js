'use strict';

function Zone (minidns, zone, {
  name, email, serial = 1, refresh = 14400, retry = 14400, expire = 1209600, ttl = 86400,
  authoritative = true, serialStyle = 'increment', zoneType = 'Primary', updateMode = 'immediate',
  defaultTTL, forwarding = true, nameservers, ...records
}) {
  this.name = (name || zone).toLowerCase();
  this.email = (email || `hostmaster.${ this.name }`).toLowerCase();
  this.serial = serial;
  this.refresh = refresh;
  this.retry = retry;
  this.expire = expire;
  this.ttl = ttl;

  this.authoritative = authoritative;
  this.forwarding = forwarding;
  this.nameservers = nameservers;

  this.serialStyle = serialStyle;
  this.zoneType = zoneType;
  this.updateMode = updateMode;
  this.defaultTTL = defaultTTL || minidns.config.options.defaultTTL;

  this.soa = minidns.models.dns.soa({
    mname: this.name,
    rname: this.email,
    serial: this.serial,
    refresh: this.refresh,
    retry: this.retry,
    expire: this.expire,
    ttl: this.ttl,
  });

  this.authority = () => ({
    name: this.name,
    type: 'SOA',
    class: 'IN',
    ttl: this.ttl,
    data: this.soa,
  });

  this.records = {};
  this.pending = {};

  for (const type of minidns.models.dns.types) {
    this.records[type] = new Map();
    this.pending[type] = new Map();
  }

  this.update = () => {
    this.serial++;
    this.soa.data.serial = this.serial;
  };

  this.publish = () => {
    for (const type of minidns.models.dns.types) {
      for (const [ id, record ] of this.pending[type]) {
        if (record === null) {
          this.records[type].delete(id);
        } else {
          this.records[type].set(id, record);
        }
      }
    }

    this.update();
  };

  this.has = (type, key) => {
    if (type in this.records) {
      for (const [ , record ] of this.records[type]) {
        if (record.test(key)) {
          return true;
        }
      }
    }
    return false;
  };

  this.resolve = (key, kind, type, fqdn) => {
    const answers = [];
    if (type in this.records) {
      for (const [ , record ] of this.records[type]) {
        if (record.test(key)) {
          answers.push({
            name: fqdn,
            type,
            class: kind,
            ttl: this.defaultTTL,
            data: record.data,
          });
        }
      }
    }

    return answers;
  };

  this.add = (type, key, data, immediate = true) => {
    if (!(type in this.records)) {
      return null;
    }

    const record = minidns.models.record({
      key,
      type,
      data,
    });

    if (immediate || this.updateMode === 'immediate') {
      this.records[type].set(record.id, record);
      this.update();
    } else {
      this.pending[type].set(record.id, record);
    }
    return record;
  };

  this.update = (type, id, data, immediate = true) => {
    if (!(type in this.records)) {
      return null;
    }

    const current = this.records[type].get(id);
    if (!current) {
      return null;
    }

    const record = minidns.models.record({
      ...current,
      data,
    });

    if (immediate || this.updateMode === 'immediate') {
      this.records[type].set(record.id, record);
      this.update();
    } else {
      this.pending[type].set(record.id, record);
    }
    return record;
  };

  this.delete = (type, id, immediate = true) => {
    if (!(type in this.records)) {
      return false;
    }

    const current = this.records[type].get(id);
    if (!current) {
      return false;
    }

    if (immediate || this.updateMode === 'immediate') {
      this.records[type].delete(id);
      this.update();
    } else {
      this.pending[type].set(id, null);
    }

    return true;
  };

  ///////

  console.log('[minidns] creating zone', this.name);
  for (const type in records) {
    if (type in this.records) {
      for (const entry of records[type]) {
        const [ key, data ] = entry;
        console.log(`[minidns]   adding ${ key }.${ this.name } IN ${ type }`);
        this.add(type, key, data);
      }
    }
  }
}

module.exports = Zone;
