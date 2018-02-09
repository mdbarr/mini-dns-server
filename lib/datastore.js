'use strict';

function Zone(name, serial, ttl) {
  this.name = name;
  this.serial = serial || 0;
  this.ttl = ttl || 300;

  this.A = {};
  this.AAAA = {};
  this.CERT = {};
  this.CNAME = {};
  this.MX = {};
  this.SRV = {};
  this.TXT = {};
};

function Datastore(minidns) {
  const self = this;

  const store = {
    prefix: minidns.util.generateAlphaNumeric(6),
    zones: {
      default: new Zone('default')
    },
    counter: 0
  };

  self.generateId = function(length) {
    const id = (store.counter++).toString(16);
    return `${ store.prefix }${ '0'.repeat(length - (id.length + store.prefix.length)) }${ id }`;
  };

  return self;
}

module.exports = function(minidns) {
  return new Datastore(minidns);
};
