'use strict';

const dns = require('node:dns').promises;
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
  33: 'SRV',
  35: 'NAPTR',
  257: 'CAA',
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

  this.createAnswer = ({
    key, question, results, ttl, authoritative = false,
  }) => {
    if (!Array.isArray(results)) {
      results = [ results ];
    }
    ttl ||= minidns.store.zone.ttl();

    const answers = results.map((result) => {
      const answer = {
        name: question.name,
        type: question.type,
        class: question.class,
        ttl,
      };

      if (typeof result === 'string') {
        switch (TYPES[answer.type]) {
          case 'CNAME':
          case 'NS':
          case 'PTR':
            answer.data = result;
            break;
          default:
            answer.address = result;
            break;
        }
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

    cache.set(key, answers);

    return answers;
  };

  this.canonicalizeQuestion = (question) => {
    const type = TYPES[question.type];
    if (type === 'CNAME') {
      return question;
    }

    const canonical = { ...question };

    for (let i = 0; i < minidns.config.options.maxDepth && i < 256; i++) {
      const zone = minidns.util.nameToZone(canonical.name);
      const query = minidns.util.nameToQuery(canonical.name);
      if (minidns.store.zone.exists(zone)) {
        const answer = minidns.store.zone.find(zone, 'CNAME', query);
        if (answer?.data) {
          canonical.name = answer.data;
          continue;
        }
      }
      break;
    }

    return canonical;
  };

  this.resolveQuestion = async (question) => {
    try {
      const canonical = this.canonicalizeQuestion(question);

      const zone = minidns.util.nameToZone(canonical.name);
      const type = TYPES[canonical.type];
      const query = minidns.util.nameToQuery(canonical.name);

      const key = `${ type }::${ question.name }`;
      let answer = cache.get(key);

      if (typeof answer !== 'undefined') {
        return answer;
      }

      let resolver = this.defaultResolver;

      if (minidns.store.zone.exists(zone)) {
        answer = minidns.store.zone.find(zone, type, query);
        if (answer) {
          return this.createAnswer({
            key,
            question,
            results: answer,
            ttl: minidns.store.zone.ttl(zone),
            authoritative: true,
          });
        } else if (!minidns.config.options.forwardZoneUnknowns) {
          return null;
        }
        resolver = minidns.store.zone.resolver(zone);
      }

      if (!minidns.config.options.silent) {
        if (canonical.name === question.name) {
          console.log(`Resolving ${ question.name } IN ${ type }`);
        } else {
          console.log(`Resolving ${ question.name }(${ canonical.name }) IN ${ type }`);
        }
      }

      let results;
      switch (type) {
        case 'A':
          results = await resolver.resolve4(canonical.name);
          console.json(results);
          break;
        case 'AAAA':
          results = await resolver.resolve6(canonical.name);
          console.json(results);
          break;
        case 'CAA':
          results = await resolver.resolveCaa(canonical.name);
          console.json(results);
          break;
        case 'CNAME':
          results = await resolver.resolveCname(canonical.name);
          console.json(results);
          break;
        case 'MX':
          results = await resolver.resolveMx(canonical.name);
          console.json(results);
          break;
        case 'NS':
          results = await resolver.resolveNs(canonical.name);
          console.json(results);
          break;
        case 'PTR':
          results = await resolver.resolvePtr(canonical.name);
          console.json(results);
          break;
        case 'SOA':
          results = await resolver.resolveSoa(canonical.name);
          console.json(results);
          break;
        case 'SRV':
          results = await resolver.resolveSrv(canonical.name);
          console.json(results);
          break;
        case 'TXT':
          results = await resolver.resolveTxt(canonical.name);
          console.json(results);
          break;
        default:
          results = await resolver.resolve(canonical.name, type);
          break;
      }

      return this.createAnswer({
        key,
        question,
        results,
      });
    } catch (error) {
      console.log('error', error);
      return null;
    }
  };

  this.resolve = async (query) => {
    let answers = await async.map(query.question, this.resolveQuestion);

    answers ||= [];
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

    return result;
  };

  //////////

  this.defaultResolver = this.createResolver('minidns', minidns.config.dns.nameservers);

  //////////
}

module.exports = (minidns) => new Resolver(minidns);
