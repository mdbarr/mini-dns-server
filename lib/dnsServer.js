'use strict';

const dgram = require('dgram');
const packet = require('native-dns-packet');

function DnsServer (minidns) {
  this.name = 'MiniDNS::DNS Server';
  this.host = minidns.config.dns.host;
  this.port = minidns.config.dns.port;

  //////////

  const dnsServer = dgram.createSocket('udp4');

  dnsServer.on('listening', () => {
    console.log(`${ this.name } listening at dns://${ this.host }:${ this.port }`);
  });

  dnsServer.on('error', (error) => {
    console.error(`${ this.name } Error: ${ error }`);
  });

  dnsServer.on('message', (message, rinfo) => {
    const query = packet.parse(message);
    minidns.resolver.resolve(query, (answer) => {
      dnsServer.send(answer, 0, answer.length, rinfo.port, rinfo.address);
    });
  });

  //////////

  this.boot = () => {
    dnsServer.bind(this.port, this.host);
  };
}

module.exports = (minidns) => new DnsServer(minidns);
