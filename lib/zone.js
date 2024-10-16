'use strict';

function Zone ({
  name, serial = 0, ttl = 300, serialStyle = 'increment', zoneType = 'Primary',
}) {
  this.name = name;
  this.serial = serial;
  this.serialStyle = serialStyle;
  this.zoneType = zoneType;
  this.ttl = ttl;

  this.records = {};

  this.pending = {};

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

module.exports = Zone;
