#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_PATH = path.join(ROOT, 'web_debug', 'index_server.mjs');

function usage(exitCode = 0) {
  const lines = [
    'Usage:',
    '  dashboard web debug',
    '  dashboard debug',
    '  dashboard --help'
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(exitCode);
}

function isWebDebugCommand(args) {
  const lowered = args.map((v) => String(v || '').toLowerCase());
  if (!lowered.length) return true;
  if (lowered.length === 1 && lowered[0] === 'debug') return true;
  if (lowered.length === 2 && lowered[0] === 'web' && lowered[1] === 'debug') return true;
  return false;
}

function runWebDebug() {
  if (!fs.existsSync(SERVER_PATH)) {
    process.stderr.write(`dashboard error: missing server at ${SERVER_PATH}\n`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(Number.isInteger(code) ? code : 0);
  });
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) usage(0);

if (!isWebDebugCommand(args)) {
  process.stderr.write(`dashboard error: unsupported command "${args.join(' ')}"\n`);
  usage(1);
}

runWebDebug();
