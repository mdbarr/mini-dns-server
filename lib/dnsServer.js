'use strict';

const dgram = require('dgram');
const packet = require('native-dns-packet');

function DnsServer(minidns) {
  const self = this;

  self.name = 'MiniDNS::DNS Server';
  self.host = minidns.config.dns.host;
  self.port = minidns.config.dns.port;

  //////////

  const dnsServer = dgram.createSocket('udp4');

  dnsServer.on('listening', function () {
    console.log(`${ self.name } listening at dns://${ self.host }:${ self.port }`);
  });

  dnsServer.on('error', function (error) {
    console.error(`${ self.name } Error: ${ error }`);
  });

  dnsServer.on('message', function (message, rinfo) {
    const query = packet.parse(message);
    minidns.resolver.resolve(query, function(answer) {
      dnsServer.send(answer, 0, answer.length, rinfo.port, rinfo.address);
    });
  });

  //////////

  self.boot = function() {
    dnsServer.bind(self.port, self.host);
  };

  return self;
}

module.exports = function(minidns) {
  return new DnsServer(minidns);
};
