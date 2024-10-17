#!/usr/bin/env node
'use strict';

require('barrkeep/pp');
const args = require('yargs').argv;
const { resolve } = require('node:path');
const process = require('node:process');
const MiniDns = require('../lib/minidns.js');

const { name } = require('../package.json');
process.title = name;

const config = { args };
if (args.config) {
  const filename = resolve(process.cwd(), args.config);
  Object.assign(config, require(filename));
}

const minidns = new MiniDns(config);
minidns.boot();
