'use strict';

const dns = require('dns');
const async = require('async');
const packet = require('native-dns-packet');

const Cache = require('node-cache');

const TYPES = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
};

const RCODES = {
  OK: 0,
  FORMAT_ERROR: 1,
  SERVER_FAILURE: 2,
  NAME_ERROR: 3,
  NOT_IMPLEMENTED: 4,
  REFUSED: 5,
};

function Resolver (minidns) {
  const cache = new Cache({ stdTTL: minidns.config.options.defaultTTL || 300 });

  this.resolvers = {};

  this.createResolver = (name, nameservers) => {
    const resolver = this.resolvers[name] || new dns.Resolver();

    if (!Array.isArray(nameservers)) {
      nameservers = [ nameservers ];
    }

    resolver.setServers(nameservers);

    this.resolvers[name] = resolver;
    return resolver;
  };

  this.createAnswer = function({
    key, question, results, ttl, authoritative = false,
  }, callback) {
    if (!Array.isArray(results)) {
      results = [ results ];
    }
    ttl = ttl || minidns.store.zone.ttl();

    const answers = results.map((result) => {
      const answer = {
        name: question.name,
        type: question.type,
        class: question.class,
        ttl,
      };

      if (typeof result === 'string') {
        answer.address = result;
      } else if (Array.isArray(result)) {
        answer.data = result;
      } else {
        Object.assign(answer, result);
      }

      if (answer.nsname) {
        answer.primary = answer.nsname;
        delete answer.nsname;
      }
      if (answer.hostmaster) {
        answer.admin = answer.hostmaster;
        delete answer.hostmaster;
      }
      if (answer.expire) {
        answer.expiration = answer.expire;
        delete answer.expire;
      }
      if (answer.minttl) {
        answer.minimum = answer.minttl;
        delete answer.minttl;
      }

      if (authoritative) {
        Object.defineProperty(answer, 'authoritative', {
          value: true,
          enumerable: false,
        });
      }

      return answer;
    });

    return cache.set(key, answers, () => {
      callback(answers);
    });
  };

  this.resolveQuestion = (question, callback) => {
    const key = `${ TYPES[question.type] }::${ question.name }`;
    cache.get(key, (error, answer) => {
      if (error || answer === undefined) {
        const zone = minidns.util.nameToZone(question.name);
        const type = TYPES[question.type];
        const query = minidns.util.nameToQuery(question.name);

        if (minidns.store.zone.exists(zone)) {
          answer = minidns.store.zone.find(zone, type, query);
          if (answer) {
            return async.setImmediate(() => this.createAnswer({
              key,
              question,
              results: answer,
              ttl: minidns.store.zone.ttl(zone),
              authoritative: true,
            }, (answers) => {
              callback(null, answers);
            }));
          } else if (minidns.config.options.forwardZoneUnknowns) {
            return minidns.store.zone.resolver(zone).
              resolve(question.name, type, (error, results) => {
                if (error) {
                  return callback(null);
                }
                return this.createAnswer({
                  key,
                  question,
                  results,
                }, (answers) => callback(null, answers));
              });
          }
          return callback(null, null);
        }
        return this.defaultResolver.
          resolve(question.name, type, (error, results) => {
            if (error) {
              return callback(null, null);
            }
            return this.createAnswer({
              key,
              question,
              results,
            }, (answers) => callback(null, answers));
          });
      }
      return callback(null, answer);
    });
  };

  this.resolve = (query, done) => async.map(query.question, this.resolveQuestion, (error, answers) => {
    answers = answers || [];
    answers = answers.reduce((a, b) => [ ...a, ...b ]) || [];
    answers = answers.filter(item => item);

    const authoritative = answers.some(item => item.authoritative);

    query.header.qr = 1;
    query.header.rd = 1;
    query.header.ra = 1;
    query.header.aa = authoritative ? 1 : 0;
    query.header.rcode = answers.length === query.question.length ? RCODES.OK : RCODES.NAME_ERROR;
    if (authoritative) {
      query.authority = answers;
    } else {
      query.answer = answers;
    }

    query.additional = [];

    if (!minidns.config.options.silent) {
      console.json(query);
    }

    const buffer = Buffer.alloc(4096);
    const size = packet.write(buffer, query);
    const result = buffer.slice(0, size);

    return done(result);
  });

  //////////

  this.defaultResolver = this.createResolver('minidns', minidns.config.dns.nameservers);

  //////////
}

module.exports = (minidns) => new Resolver(minidns);
