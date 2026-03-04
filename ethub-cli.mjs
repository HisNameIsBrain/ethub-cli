#!/usr/bin/env node

import OpenAI from "openai";
import chalk from "chalk";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/* ======================================================
   CONFIG
   ====================================================== */

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const temperature = Number(process.env.ETHUB_TEMPERATURE ?? "0.2");
const maxTokens = Number(process.env.ETHUB_MAX_TOKENS ?? "512");

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are ETHUB CLI, a dev assistant for the ETHUB Next.js app.
- Focus on debugging and code help.
- Prefer ./app files only. If you need to edit files outside this folder you MUST ask for approval and explin reasoning.
- No git commands.
- No destructive shell commands.
- Keep responses concise and safe.
`;

/* ======================================================
   CONSTANTS
   ====================================================== */

const LEFT_PAD = "  ";
const HEADER_WIDTH = 70;
const DIVIDER_CHARS = "=-";

const ETHUB_ASCII = [
  "oooooooooooo ooooooooooooo ooooo   ooooo ooooo     ooo oooooooooo.",
  "`888'     `8 8'   888   `8 `888'   `888' `888'     `8' `888'   `Y8b",
  " 888              888       888     888   888       8   888     888",
  " 888oooo8         888       888ooooo888   888       8   888oooo888'",
  " 888              888       888     888   888       8   888    `88b",
  " 888       o      888       888     888   `88.    .8'   888    .88P",
  "o888ooooood8     o888o     o888o   o888o    `YbodP'    o888bood8P'"
];

const SUGGESTIONS = [
  "Search for conflicts or TODOs in ./app.",
  "Review security or privacy risks.",
  "Generate a safe refactor plan."
];

/* ======================================================
   COLOR HELPERS
   ====================================================== */

function hslToRgb(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(c * 255);
  };
  return { r: f(0), g: f(8), b: f(4) };
}

function rainbowDivider(width, phase) {
  let out = "";
  for (let i = 0; i < width; i++) {
    const ch = DIVIDER_CHARS[i % DIVIDER_CHARS.length];
    const p = (i / width + phase) % 1;
    const { r, g, b } = hslToRgb(p * 360, 0.6, 0.65);
    out += chalk.rgb(r, g, b)(ch);
  }
  return out;
}

function rainbowAsciiLine(line, row, totalRows, frame) {
  let out = "";
  const len = Math.max(line.length, 1);

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === " ") {
      out += " ";
      continue;
    }

    const phase = (i / len + row / totalRows + frame * 0.01) % 1;
    const { r, g, b } = hslToRgb(phase * 360, 0.6, 0.65);

    let display = ch;
    if ((ch === "o" || ch === "8") && (frame + i + row) % 47 === 0) {
      display = "+";
    }

    out += chalk.rgb(r, g, b)(display);
  };

  return out;
}

/* ======================================================
   HEADER (ANIMATED, SINGLE INSTANCE)
   ====================================================== */

function drawHeader(frame) {
  const p1 = (frame / 90) % 1;
  const p2 = (p1 + 0.33) % 1;
  const p3 = (p1 + 0.66) % 1;

  console.log(LEFT_PAD + rainbowDivider(HEADER_WIDTH, p1));
  ETHUB_ASCII.forEach((line, r) =>
    console.log(
      LEFT_PAD + rainbowAsciiLine(line, r, ETHUB_ASCII.length, frame)
    )
  );
  console.log(
    LEFT_PAD +
      chalk.gray(
        `Mode: CHAT | Model: ${model} | Temp: ${temperature} | Tokens: ${maxTokens}`
      )
  );
  console.log(LEFT_PAD + rainbowDivider(HEADER_WIDTH, p3));
}

/* ======================================================
   SUGGESTIONS (TYPEWRITER)
   ====================================================== */
async function showSuggestions() {
  console.log();
  console.log(LEFT_PAD + chalk.gray("Suggestions (you can just start typing):"));
  for (const s of SUGGESTIONS) {
    let buf = "";
    for (const ch of s) {
      buf += ch;
      process.stdout.write("\r" + LEFT_PAD + chalk.gray("• " + buf));
      await new Promise((r) => setTimeout(r, 18));
    }
    process.stdout.write("\n");
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log();
}

/* ======================================================
   THINKING INDICATOR
   ====================================================== */

let thinkingTimer = null;

function startThinking() {
  let i = 0;
  thinkingTimer = setInterval(() => {
    const dots = ".".repeat(i % 4);
    process.stdout.write(
      "\r" +
        LEFT_PAD +
        chalk.cyan("Thinking") +
        dots.padEnd(3, " ") +
        chalk.gray(" parsing your request") +
        " ".repeat(20)
    );
    i++;
  }, 140);
}

function stopThinking() {
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
    process.stdout.write("\n");
  }
}

/* ======================================================
   READLINE
   ====================================================== */
const rl = readline.createInterface({ input, output });
const promptLabel = chalk.cyan.bold("$: ");

const history = [];

function clampHistory(max = 10) {
  if (history.length > max * 2) {
    history.splice(0, history.length - max * 2);
  }
}

/* ======================================================
   MAIN LOOP
   ====================================================== */

/* ======================================================
   USER INPUT LOOP
   ====================================================== */
async function handleUserInput() {
  let line;

  try {
    // Wait for user input at "$: "
    line = await rl.question(promptLabel);
  } catch (err) {
    // Ctrl+C while waiting on rl.question
    if (err && err.name === "AbortError") {
      console.log(chalk.gray("\n^C — exiting ETHUB CLI."));
      return false; // stop main loop
    }
    // Any other error should still surface
    throw err;
  }

  const trimmed = line.trim();
  if (!trimmed) return true;

  if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
    return false;
  }

  // Track conversation
  history.push({ role: "user", content: trimmed });
  clampHistory();

  startThinking();

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      temperature,
      max_tokens: maxTokens
    });

    stopThinking();

    const text =
      res.choices?.[0]?.message?.content?.trim() || "[no output]";    
    console.log();
    console.log(chalk.magenta.bold("ETHUB > ") + text);
    console.log(LEFT_PAD + "-".repeat(HEADER_WIDTH));
  } catch (err) {
    stopThinking();
    console.error(
      chalk.red("Error:"),
      err?.message || String(err)
    );}
/* ======================================================
   ENTRYPOINT
   ====================================================== */

async function main() {
  console.clear();
  process.stdout.write("\x1b[H");

  drawHeader(0);
console.clear();
  await showSuggestions();

  let running = true;
  while (running) {
    running = await handleUserInput();
  }

rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err?.stack || String(err));
  process.exit(1);
});
}
