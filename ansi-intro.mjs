#!/usr/bin/env node
const useIntro =
  process.stdout.isTTY &&
  !process.env.CI &&
  process.env.NO_ANSI_INTRO !== "1";

if (!useIntro) {
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const frames = [
  [
    "\x1b[2J\x1b[H",
    "\x1b[38;5;238m·     ·       ·   ·     ·\x1b[0m",
    "\x1b[3;12H\x1b[38;5;25m┌───────────────┐\x1b[0m",
    "\x1b[4;12H\x1b[38;5;25m│\x1b[38;5;81m  E   T   H   U   B  \x1b[38;5;25m│\x1b[0m",
    "\x1b[5;12H\x1b[38;5;25m└───────────────┘\x1b[0m",
  ],
  [
    "\x1b[2J\x1b[H",
    "\x1b[38;5;238m·   ·    ·   ·      ·   ·\x1b[0m",
    "\x1b[3;12H\x1b[38;5;25m┌───────────────┐\x1b[0m",
    "\x1b[4;12H\x1b[38;5;117m  E   T   H   U   B  \x1b[0m",
    "\x1b[5;12H\x1b[38;5;25m└───────────────┘\x1b[0m",
    "\x1b[7;14H\x1b[38;5;245mEngineering • Training • Systems\x1b[0m",
  ],
  [
    "\x1b[2J\x1b[H",
    "\x1b[38;5;238m·   ·    ·   ·      ·   ·\x1b[0m",
    "\x1b[3;12H\x1b[38;5;25m┌───────────────┐\x1b[0m",
    "\x1b[4;12H\x1b[38;5;81m  E   T   H   U   B  \x1b[0m",
    "\x1b[5;12H\x1b[38;5;25m└───────────────┘\x1b[0m",
    "\x1b[7;14H\x1b[38;5;252mEngineering • Training • Systems\x1b[0m",
    "\x1b[9;18H\x1b[38;5;240m░ ░ ▒ ▒ ▓  ▓ ▒ ▒ ░ ░\x1b[0m",
  ],
  [
    "\x1b[2J\x1b[H",
    "\x1b[38;5;238m·     ·       ·   ·     ·\x1b[0m",
    "\x1b[3;12H\x1b[38;5;25m┌───────────────┐\x1b[0m",
    "\x1b[4;12H\x1b[38;5;117m  E   T   H   U   B  \x1b[0m",
    "\x1b[5;12H\x1b[38;5;25m└───────────────┘\x1b[0m",
    "\x1b[7;14H\x1b[38;5;252mEngineering • Training • Systems\x1b[0m",
    "\x1b[9;18H\x1b[38;5;240m░ ░ ░ ▒ ▓  ▓ ▒ ░ ░ ░\x1b[0m",
  ],
];

const frameDelayMs = 80;
const holdMs = 600;

const showCursor = () => process.stdout.write("\x1b[?25h");
const hideCursor = () => process.stdout.write("\x1b[?25l");

async function run() {
  hideCursor();
  for (const frame of frames) {
    process.stdout.write(frame.join("\n") + "\n");
    await sleep(frameDelayMs);
  }
  await sleep(holdMs);
} 

run()
  .catch(() => {})
  .finally(() => {
    showCursor();
  });
