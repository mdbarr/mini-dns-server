'use strict';

const isRegExp = /^\/([^]+)\/$/u;

function Models (minidns) {
  this.dns = function (type, ...args) {
    switch (type) {
      case 'A':
        return this.dns.a(...args);
      case 'AAAA':
        return this.dns.aaaa(...args);
      case 'CAA':
        return this.dns.caa(...args);
      case 'CNAME':
        return this.dns.cname(...args);
      case 'DNAME':
        return this.dns.dname(...args);
      case 'DNSKEY':
        return this.dns.dnskey(...args);
      case 'DS':
        return this.dns.ds(...args);
      case 'HINFO':
        return this.dns.hinfo(...args);
      case 'MX':
        return this.dns.mx(...args);
      case 'NAPTR':
        return this.dns.naptr(...args);
      case 'PTR':
        return this.dns.ptr(...args);
      case 'SOA':
        return this.dns.soa(...args);
      case 'SRV':
        return this.dns.srv(...args);
      case 'TXT':
        return this.dns.txt(...args);
      default:
        return this.dns.a(...args);
    }
  };

  this.dns.a = ({ data }) => data;

  this.dns.aaaa = ({ data }) => data;

  this.dns.caa = ({
    flags = 0, tag = 'issue', value, issuerCritical = false,
  }) => ({
    flags,
    tag,
    value,
    issuerCritical,
  });

  this.dns.cname = ({ data }) => data;

  this.dns.dname = ({ data }) => data;

  this.dns.dnskey = ({
    flags, algorithm, key,
  }) => ({
    flags,
    algorithm,
    key,
  });

  this.dns.ds = ({
    keyTag, algorithm, digestType, digest,
  }) => ({
    keyTag,
    algorithm,
    digestType,
    digest,
  });

  this.dns.hinfo = ({ cpu, os }) => ({
    data: {
      cpu,
      os,
    },
  });

  this.dns.mx = ({ preference = 10, exchange }) => ({
    preference,
    exchange,
  });

  this.dns.naptr = ({
    order = 100, preference = 10, flags, services, regexp, replacement,
  }) => ({
    data: {
      order,
      preference,
      flags,
      services,
      regexp,
      replacement,
    },
  });

  this.dns.ns = ({ data }) => data;

  this.dns.ptr = ({ data }) => data;

  this.dns.soa = ({
    mname, rname, serial = 1, refresh = 14400, retry = 14400, expire = 1209600, ttl = 86400,
  }) => ({
    data: {
      mname,
      rname,
      serial,
      refresh,
      retry,
      expire,
      minimum: ttl,
    },
  });

  this.dns.srv = ({
    port, target, priority, weight,
  }) => ({
    data: {
      port,
      target,
      priority,
      weight,
    },
  });

  this.dns.txt = ({ data }) => data;

  this.dns.types = [
    'A', 'AAAA', 'CAA', 'CNAME', 'DNAME', 'DNSKEY', 'DS',
    'HINFO', 'MX', 'NAPTR', 'PTR', 'SOA', 'SRV', 'TXT',
  ];

  //////////

  this.record = ({
    id, key = '', type = 'A', data,
  }) => {
    let regexp;

    if (key === '*') {
      regexp = /[^]+/u;
    } else if (key instanceof RegExp) {
      regexp = key;
    } else if (isRegExp.test(key)) {
      const [ , pattern ] = key.match(isRegExp);
      regexp = new RegExp(pattern, 'iu');
    } else {
      regexp = new RegExp(`^${ key }$`, 'iu');
    }

    const record = {
      id: id || minidns.utils.sha1(key.toString() + JSON.stringify(data)),
      key,
      test: (string) => regexp.test(string),
      type,
      data: this.dns(type, data ),
      timestamp: minidns.utils.timestamp(),
    };

    return record;
  };
}

module.exports = (minidns) => new Models(minidns);
