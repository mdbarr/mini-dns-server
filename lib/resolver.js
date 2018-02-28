'use strict';

const dns = require('dns');
const async = require('async');
const packet = require('native-dns-packet');

const TYPES = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA'
};

const RCODES = {
  OK: 0,
  FORMAT_ERROR: 1,
  SERVER_FAILURE: 2,
  NAME_ERROR: 3,
  NOT_IMPLEMENTED: 4,
  REFUSED: 5
};

function Resolver(minidns) {
  const self = this;

  self.resolvers = {};

  self.createResolver = function(name, nameservers) {
    const resolver = self.resolvers[name] || new dns.Resolver();

    if (!Array.isArray(nameservers)) {
      nameservers = [ nameservers ];
    }

    resolver.setServers(nameservers);

    self.resolvers[name] = resolver;
    return resolver;
  };

  self.createAnswer = function(question, results, ttl) {
    if (!Array.isArray(results)) {
      results = [ results ];
    }
    ttl = ttl || minidns.store.zone.ttl();

    return results.map(function(result) {
      const answer = {
        name: question.name,
        type: question.type,
        class: question.class,
        ttl: ttl
      };

      if (typeof result === 'string') {
        answer.address = result;
      } else {
        Object.assign(answer, result);
      }
      return answer;
    });
  };

  self.resolveQuestion = function(question, callback) {
    const zone = minidns.util.nameToZone(question.name);
    const type = TYPES[question.type];
    const query = minidns.util.nameToQuery(question.name);

    let answer;
    if (minidns.store.zone.exists(zone)) {
      answer = minidns.store.zone.find(zone, type, query);
      if (answer) {
        return callback(null, self.createAnswer(question, answer, minidns.store.zone.ttl(zone)));
      } else if (minidns.config.options.forwardZoneUnknowns) {
        return minidns.store.zone.resolver(zone).resolve(question.name, type, function(error, results) {
          if (error) {
            callback(null);
          } else {
            return callback(null, self.createAnswer(question, results));
          }
        });
      } else {
        return callback(null, null);
      }
    } else {
      return self.defaultResolver.resolve(question.name, type, function(error, results) {
        if (error) {
          callback(null, null);
        } else {
          return callback(null, self.createAnswer(question, results));
        }
      });
    }
  };

  self.resolve = function(query, done) {
    async.map(query.question, self.resolveQuestion, function(error, answers) {
      answers = answers || [];
      answers = answers.reduce((a, b) => [ ...a, ...b ]) || [];
      answers = answers.filter(item => item);

      query.header.qr = 1;
      query.header.rd = 1;
      query.header.ra = 1;
      query.header.rcode = (answers.length === query.question.length) ? RCODES.OK : RCODES.NAME_ERROR;
      query.answer = answers;

      const buffer = Buffer.alloc(4096);
      const size = packet.write(buffer, query);
      const result = buffer.slice(0, size);

      done(result);
    });
  };

  //////////

  self.defaultResolver = self.createResolver('minidns', minidns.config.dns.nameservers);

  //////////

  return self;
}

module.exports = function(minidns) {
  return new Resolver(minidns);
};
