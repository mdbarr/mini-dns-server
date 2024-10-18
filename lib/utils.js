'use strict';

const crypto = require('node:crypto');
const { deepClone, merge } = require('barrkeep/utils');

function generateAlphaNumeric (length) {
  const possibleAlphaNumerics = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
  let generated = '';
  for (let i = 0; i < length; i++) {
    generated += possibleAlphaNumerics.charAt(random(0, possibleAlphaNumerics.length - 1));
  }
  return generated;
}

function generateUniqueId (length = 24, encoding = 'hex') {
  return crypto.randomBytes(Math.ceil(length / 2)).toString(encoding);
}

function logger (req) {
  console.log(req.method, req.url, req.params, req.query);

  if (req.authorization) {
    console.pp(req.authorization);
  }
  if (req.headers) {
    console.pp(req.headers);
  }
  if (req.authorization) {
    console.pp(req.authorization);
  }
  if (req.body) {
    console.pp(req.body);
  }
}

function nameToQuery (name) {
  return name.replace(/\.[^]+$/u, '');
}

function nameToZone (name) {
  return name.replace(/^[^.]+\./u, '');
}

function random (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sha1 (input) {
  if (typeof input !== 'string') {
    input = JSON.stringify(input);
  }
  return crypto.createHash('sha1').update(input).
    digest('base64');
}

function timestamp (units = 'ms') {
  if (units === 's' || units === 'seconds') {
    return Math.floor(Date.now() / 1000);
  }
  return Date.now();
}

module.exports = {
  clone: deepClone,
  generateAlphaNumeric,
  generateUniqueId,
  logger,
  merge,
  nameToQuery,
  nameToZone,
  sha1,
  timestamp,
};
