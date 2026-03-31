#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname);
const SERVER_PATH = path.join(ROOT, 'web_debug', 'index_server.mjs');

function runAgent() {
  require('./src/cli/ethub_cli.js');
}

function printEthubUsage(exitCode = 0, out = process.stdout) {
  out.write('Usage:\n');
  out.write('  ethub cli\n');
  out.write('  ethub clu\n');
  out.write('  ethub --help\n');
  out.write('  ethub-cli\n');
  out.write('  ethub-cli dashboard [debug|web debug]\n');
  process.exit(exitCode);
}

function printDashboardUsage(exitCode = 0, out = process.stdout) {
  const lines = [
    'Usage:',
    '  dashboard web debug',
    '  dashboard debug',
    '  dashboard --help',
    '  ethub-cli dashboard web debug'
  ];
  out.write(`${lines.join('\n')}\n`);
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

function runDashboardMode(args) {
  if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
    printDashboardUsage(0);
  }

  if (!isWebDebugCommand(args)) {
    process.stderr.write(`dashboard error: unsupported command "${args.join(' ')}"\n`);
    printDashboardUsage(1, process.stderr);
  }

  runWebDebug();
}

function main() {
  const invokedAs = path.basename(process.argv[1] || '').toLowerCase();
  const args = process.argv.slice(2);
  const lowerArgs = args.map((v) => String(v || '').toLowerCase());
  const first = lowerArgs[0] || '';

  if (invokedAs === 'dashboard') {
    runDashboardMode(lowerArgs);
    return;
  }

  if (invokedAs === 'ethub') {
    if (!lowerArgs.length || first === 'cli' || first === 'clu') {
      runAgent();
      return;
    }
    if (first === '--help' || first === '-h' || first === 'help') {
      printEthubUsage(0);
      return;
    }
    process.stderr.write(`ethub error: unsupported command "${args.join(' ')}"\n`);
    printEthubUsage(1, process.stderr);
    return;
  }

  if (!lowerArgs.length || first === 'cli' || first === 'clu') {
    runAgent();
    return;
  }

  if (first === 'dashboard') {
    runDashboardMode(lowerArgs.slice(1));
    return;
  }

  if (first === '--help' || first === '-h' || first === 'help') {
    printEthubUsage(0);
    return;
  }

  process.stderr.write(`ethub-cli error: unsupported command "${args.join(' ')}"\n`);
  printEthubUsage(1, process.stderr);
}

main();
