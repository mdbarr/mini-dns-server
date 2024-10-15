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
  255: 'ANY',
  257: 'CAA',
  A: 1,
  AAAA: 28,
  ANY: 255,
  CAA: 257,
  CNAME: 5,
  MX: 15,
  NAPTR: 35,
  NS: 2,
  PTR: 12,
  SOA: 6,
  SRV: 33,
  TXT: 16,
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
    key, question, answers, ttl, authoritative = false,
  }) => {
    if (!Array.isArray(answers)) {
      answers = [ answers ];
    }
    ttl ||= minidns.store.zone.ttl();

    answers = answers.map((result) => {
      const answer = {
        name: result.name || question.name,
        type: result.type || question.type,
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

      if (typeof answer.type === 'string') {
        answer.type = TYPES[answer.type];
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

      answer.authoritative = authoritative;

      if (!minidns.config.options.silent) {
        console.log(`${ answer.name } IN ${ TYPES[answer.type] } ${ answer.address || answer.data }`);
      }

      return answer;
    });

    cache.set(key, {
      authoritative,
      answers,
      ttl,
      timestamp: minidns.util.timestamp(),
    }, ttl);

    return answers;
  };

  this.canonicalizeQuestion = (question, answers = []) => {
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
          answers.push({
            name: canonical.name,
            type: 5,
            data: answer.data,
          });
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
      const type = TYPES[question.type];

      const zone = minidns.util.nameToZone(question.name);
      const query = minidns.util.nameToQuery(question.name);
      const key = minidns.util.sha1(question);

      const cached = cache.get(key);

      if (typeof cached !== 'undefined') {
        const answers = minidns.util.clone(cached.answers);
        const diff = minidns.util.timestamp() - cached.timestamp;
        for (const answer of answers) {
          if (typeof answer.ttl === 'number') {
            answer.ttl = Math.max(answer.ttl -= diff, 1);
          }
        }
        return answers;
      }

      let resolver = this.defaultResolver;

      if (minidns.store.zone.exists(zone)) {
        const answer = minidns.store.zone.find(zone, type, query);
        if (answer) {
          return this.createAnswer({
            key,
            question,
            answers: answer,
            ttl: minidns.store.zone.ttl(zone),
            authoritative: true,
          });
        } else if (minidns.config.options.forwardZoneUnknowns) {
          resolver = minidns.store.zone.resolver(zone);
        } else {
          resolver = null;
        }
      }

      const answers = [];
      const canonical = this.canonicalizeQuestion(question, answers);

      if (!minidns.config.options.silent) {
        if (canonical.name === question.name) {
          console.log(`Resolving ${ question.name } IN ${ type }`);
        } else {
          console.log(`Resolving ${ question.name } as ${ canonical.name } IN ${ type }...`);
        }
      }

      if (resolver) {
        try {
          switch (type) {
            case 'A':
              answers.push(...await resolver.resolve4(canonical.name, { ttl: true }));
              break;
            case 'AAAA':
              answers.push(...await resolver.resolve6(canonical.name, { ttl: true }));
              break;
            case 'ANY':
              answers.push(...await resolver.resolveAny(canonical.name));
              break;
            case 'CAA':
              answers.push(...await resolver.resolveCaa(canonical.name));
              break;
            case 'CNAME':
              answers.push(...await resolver.resolveCname(canonical.name));
              break;
            case 'MX':
              answers.push(...await resolver.resolveMx(canonical.name));
              break;
            case 'NS':
              answers.push(...await resolver.resolveNs(canonical.name));
              break;
            case 'PTR':
              answers.push(...await resolver.resolvePtr(canonical.name));
              break;
            case 'SOA':
              answers.push(...await resolver.resolveSoa(canonical.name));
              break;
            case 'SRV':
              answers.push(...await resolver.resolveSrv(canonical.name));
              break;
            case 'TXT':
              answers.push(...await resolver.resolveTxt(canonical.name));
              break;
            default:
              answers.push(...await resolver.resolve(canonical.name, type));
              break;
          }
        } catch (error) {
          if (error.code !== 'ENOTFOUND') {
            throw error;
          }
        }
      }

      return this.createAnswer({
        key,
        question: canonical,
        answers,
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
