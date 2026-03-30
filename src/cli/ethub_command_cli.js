#!/usr/bin/env node

function usage(exitCode = 0) {
  process.stdout.write('Usage:\n');
  process.stdout.write('  ethub cli\n');
  process.stdout.write('  ethub clu\n');
  process.stdout.write('  ethub --help\n');
  process.exit(exitCode);
}

const args = process.argv.slice(2).map((v) => String(v || '').toLowerCase());
if (!args.length || args[0] === 'cli' || args[0] === 'clu') {
  require('../../ethub_cli.js');
} else if (args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
  usage(0);
} else {
  process.stderr.write(`ethub error: unsupported command "${args.join(' ')}"\n`);
  usage(1);
}
