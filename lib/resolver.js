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

        socket.on('message', (message) => {
          clearTimeout(timer);
          socket.close();

          const response = dnsPacket.decode(message);
          return resolve(response);
        });

        socket.send(packet, 0, packet.length, 53, nameserver);
      }));

    return async.tryEach(nameservers.map(resolver));
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
        const answer = minidns.store.zone.resolve(zone, query, 'IN', 'CNAME', canonical.name);
        if (answer.length) {
          answers.push({
            name: canonical.name,
            type: 'CNAME',
            class: 'IN',
            data: answer[0].data,
          });
          canonical.name = answer[0].data;
          continue;
        }
      }
      break;
    }

    return canonical;
  };

  this.resolve = async (query) => {
    try {
      const [ question ] = query.questions;
      const zone = minidns.utils.nameToZone(question.name);
      const name = minidns.utils.nameToQuery(question.name);
      const key = minidns.utils.sha1(question);

      const cached = cache.get(key);

      if (typeof cached !== 'undefined') {
        const answers = minidns.utils.clone(cached.answers);
        const diff = minidns.utils.timestamp('s') - cached.timestamp;
        for (const answer of answers) {
          if (typeof answer.ttl === 'number') {
            answer.ttl = Math.max(answer.ttl -= diff, 1);
          }
        }

        const answer = {
          type: 'response',
          id: query.id,
          flags: cached.flags,
          questions: query.questions,
          answers,
          additionals: cached.additionals,
          authorities: cached.authorities,
        };

        return this.encode(null, answer);
      }

      const answers = [];
      const canonical = this.canonicalizeQuestion(question, answers);

      if (minidns.store.zone.exists(zone)) {
        const resolved = minidns.store.zone.resolve(zone, name, question.class, question.type, question.name);
        if (resolved.length || !minidns.store.zone.shouldForward(zone)) {
          const answer = {
            type: 'response',
            id: query.id,
            flags: query.flags,
            questions: query.questions,
            answers: [ ...answers, ...resolved ],
            additionals: query.additionals,
            authorities: minidns.store.zone.authority(zone),
          };

          return this.encode(key, answer);
        }
      }

      if (!minidns.config.options.silent) {
        if (canonical.name === question.name) {
          console.log(`Resolving ${ question.name } ${ question.class } ${ question.type }...`);
        } else {
          console.log(`Resolving ${ question.name } as ${ canonical.name } ${ question.class } ${ question.type }...`);
        }
      }

      const response = await this.resolver(query, canonical, minidns.store.zone.nameservers(zone));

      if (response) {
        const answer = {
          type: 'response',
          id: query.id,
          flags: response.flags,
          questions: query.questions,
          answers: [ ...answers, ... response.answers ],
          additionals: response.additionals,
          authorities: response.authorities,
        };

        return this.encode(key, answer);
      }
    } catch (error) {
      console.log('[dns] error in resolver', error);
    }
    return null;
  };

  this.encode = (key, answer) => {
    try {
      if (key) {
        cache.set(key, {
          flags: answer.flags,
          answers: answer.answers,
          additionals: answer.additionals,
          authorities: answer.authorities,
          timestamp: minidns.utils.timestamp('s'),
        });
      }
      return dnsPacket.encode(answer);
    } catch (error) {
      console.log('[resolver] error in encoding', error);
      return null;
    }
  };
}

module.exports = (minidns) => new Resolver(minidns);
