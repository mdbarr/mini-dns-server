'use strict';

const async = require('async');
const dgram = require('node:dgram');
const dnsPacket = require('dns-packet');
const Cache = require('node-cache');

function Resolver (minidns) {
  const cache = new Cache({ stdTTL: minidns.config.options.defaultTTL || 300 });

  this.resolver = (query, question, nameservers = minidns.config.dns.nameservers) => {
    const { retries } = minidns.config.dns;
    const { timeout } = minidns.config.dns;

    const packet = dnsPacket.encode({
      ...query,
      questions: [ question ],
    });

    const resolver = (nameserver) => async () => async.retry(retries,
      async () => new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');

        const timer = setTimeout(() => {
          socket.close();
          return reject(new Error('ETIMEOUT'));
        }, timeout);

        socket.on('message', (message, rinfo) => {
          clearTimeout(timer);
          socket.close();

          const response = dnsPacket.decode(message);
          console.pp(response);
          return resolve(response);
        });

        socket.send(packet, 0, packet.length, 53, nameserver);
      }));

    return async.tryEach(nameservers.map(resolver));
  };

  this.answer = ({
    key, question, results, ttl, authoritative = false,
  }) => {
    ttl ||= minidns.store.zone.ttl();

    const answers = [];

    for (const result of results) {
      const answer = {
        type: result.type || question.type,
        class: result.class || question.class,
        name: result.name || question.name,
        ttl: result.ttl || ttl,
      };

      switch (answer.type) {
        case 'A':
        case 'AAAA':
        case 'CNAME':
        case 'DNAME':
          answer.data = result.data || result.address;
          break;
        case 'MX':
          answer.preference = result.preference || 10;
          break;
      }

      if (!minidns.config.options.silent) {
        console.log(`${ answer.name } IN ${ answer.type } ${ answer.data }`);
      }
    }

    cache.set(key, {
      authoritative,
      answers,
      ttl,
      timestamp: minidns.utils.timestamp(),
    }, ttl);

    return answers;
  };

  this.canonicalizeQuestion = (question, answers = []) => {
    if (question.type === 'CNAME') {
      return question;
    }

    const canonical = { ...question };

    for (let i = 0; i < minidns.config.options.maxDepth && i < 256; i++) {
      const zone = minidns.utils.nameToZone(canonical.name);
      const query = minidns.utils.nameToQuery(canonical.name);
      if (minidns.store.zone.exists(zone)) {
        const answer = minidns.store.zone.find(zone, 'CNAME', query);
        if (answer?.data) {
          answers.push({
            name: canonical.name,
            type: 'CNAME',
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

  this.resolve = async (query) => {
    const [ question ] = query.questions;
    const zone = minidns.utils.nameToZone(question.name);
    const name = minidns.utils.nameToQuery(question.name);
    const key = minidns.utils.sha1(question);

    const cached = cache.get(key);

    // if (typeof cached !== 'undefined') {
    //   const answers = minidns.utils.clone(cached.answers);
    //   const diff = minidns.utils.timestamp() - cached.timestamp;
    //   for (const answer of answers) {
    //     if (typeof answer.ttl === 'number') {
    //       answer.ttl = Math.max(answer.ttl -= diff, 1);
    //     }
    //   }
    //   return answers;
    // }

    // if (minidns.store.zone.exists(zone)) {
    //   const answer = minidns.store.zone.find(zone, question.type, query);
    //   if (answer) {
    //     return this.createAnswer({
    //       key,
    //       question,
    //       results: answer,
    //       ttl: minidns.store.zone.ttl(zone),
    //       authoritative: true,
    //     });
    //   } else if (minidns.config.options.forwardZoneUnknowns) {
    //     //resolver = minidns.store.zone.resolver(zone);
    //   } else {
    //     //resolver = null;
    //   }
    // }

    const answers = [];
    const canonical = this.canonicalizeQuestion(question, answers);

    if (!minidns.config.options.silent) {
      if (canonical.name === question.name) {
        console.log(`Resolving ${ question.name } ${ question.class } ${ question.type }...`);
      } else {
        console.log(`Resolving ${ question.name } as ${ canonical.name } ${ question.class } ${ question.type }...`);
      }
    }

    const response = await this.resolver(query, canonical, [ '8.8.8.8' ]);

    const answer = {
      type: 'response',
      id: query.id,
      flags: response.flags,
      questions: query.questions,
      answers: response.answers,
      additionals: response.additionals,
      authorities: response.authorities,
    };
    //    console.pp(answer);

    return dnsPacket.encode(answer);
  };
}

module.exports = (minidns) => new Resolver(minidns);
