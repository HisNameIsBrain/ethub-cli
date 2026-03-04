/**
 * @file help.mjs
 * @description Help and documentation commands for ETHUB CLI
 * @module cli/commands/help
 * 
 * WHY: Clear documentation improves user experience and productivity
 * WHAT: Display available commands, usage examples, and tips
 * WHERE: Called from main CLI when /help command is detected
 * WHEN: User needs guidance on CLI usage
 */

import chalk from "chalk";
import { LEFT_PAD, HEADER_WIDTH } from "../helpers/colors.mjs";

/* ======================================================
   COMMAND DOCUMENTATION
   ====================================================== */

const COMMANDS = {
  pr: {
    description: "Pull request management",
    usage: "/pr <subcommand>",
    subcommands: {
      "create [title]": "Create a new PR with optional title",
      "list": "List open pull requests",
      "view <number>": "View PR details",
      "status": "Show PR status for current branch",
    },
  },
  analyze: {
    description: "Code analysis and inspection",
    usage: "/analyze <file>",
    subcommands: {
      "<file>": "Analyze a specific file",
    },
  },
  audit: {
    description: "Security audit",
    usage: "/audit [path]",
    subcommands: {
      "[path]": "Audit specific path (default: entire workspace)",
    },
  },
  diff: {
    description: "View and manage changes",
    usage: "/diff <subcommand>",
    subcommands: {
      "show [file]": "Show diff for file or all changes",
      "staged [file]": "Show staged changes",
      "stage <file>": "Stage a file for commit",
      "unstage <file>": "Unstage a file",
    },
  },
  snippet: {
    description: "Code snippet management",
    usage: "/snippet <subcommand>",
    subcommands: {
      "save <name>": "Save a new code snippet",
      "load <name>": "Load and display a snippet",
      "list": "List all saved snippets",
      "delete <name>": "Delete a snippet",
    },
  },
  help: {
    description: "Show this help message",
    usage: "/help [command]",
    subcommands: {
      "[command]": "Get detailed help for a specific command",
    },
  },
  clear: {
    description: "Clear the screen",
    usage: "/clear",
    subcommands: {},
  },
  exit: {
    description: "Exit the CLI",
    usage: "exit, quit, or q",
    subcommands: {},
  },
};

/* ======================================================
   HELP DISPLAY
   ====================================================== */

/**
 * Display general help
 */
export function showGeneralHelp() {
  console.log();
  console.log(`${LEFT_PAD}${chalk.cyan.bold("ETHUB CLI - Available Commands")}`);
  console.log(`${LEFT_PAD}${"-".repeat(50)}`);
  console.log();

  // Commands section
  console.log(`${LEFT_PAD}${chalk.yellow("Commands:")}`);
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`${LEFT_PAD}  ${chalk.cyan(`/${name}`).padEnd(25)} ${cmd.description}`);
  }

  console.log();
  console.log(`${LEFT_PAD}${chalk.yellow("Chat Mode:")}`);
  console.log(`${LEFT_PAD}  Just type your question or request to chat with the AI assistant.`);
  console.log(`${LEFT_PAD}  The assistant can help with debugging, code reviews, and suggestions.`);

  console.log();
  console.log(`${LEFT_PAD}${chalk.yellow("Tips:")}`);
  console.log(`${LEFT_PAD}  • Use ${chalk.cyan("/help <command>")} for detailed command help`);
  console.log(`${LEFT_PAD}  • Type ${chalk.cyan("exit")}, ${chalk.cyan("quit")}, or ${chalk.cyan("q")} to exit`);
  console.log(`${LEFT_PAD}  • Press ${chalk.cyan("Ctrl+C")} to cancel current operation`);

  console.log();
  console.log(`${LEFT_PAD}${"-".repeat(50)}`);
}

/**
 * Display help for a specific command
 * @param {string} commandName - Command name
 */
export function showCommandHelp(commandName) {
  const cmd = COMMANDS[commandName.toLowerCase()];

  if (!cmd) {
    console.log();
    console.log(`${LEFT_PAD}${chalk.red("Unknown command:")} ${commandName}`);
    console.log(`${LEFT_PAD}Type ${chalk.cyan("/help")} to see available commands.`);
    return;
  }

  console.log();
  console.log(`${LEFT_PAD}${chalk.cyan.bold(`/${commandName}`)} - ${cmd.description}`);
  console.log(`${LEFT_PAD}${"-".repeat(50)}`);
  console.log();

  console.log(`${LEFT_PAD}${chalk.yellow("Usage:")}`);
  console.log(`${LEFT_PAD}  ${cmd.usage}`);

  if (Object.keys(cmd.subcommands).length > 0) {
    console.log();
    console.log(`${LEFT_PAD}${chalk.yellow("Subcommands:")}`);
    for (const [sub, desc] of Object.entries(cmd.subcommands)) {
      console.log(`${LEFT_PAD}  ${chalk.cyan(sub).padEnd(20)} ${desc}`);
    }
  }

  // Command-specific examples
  console.log();
  console.log(`${LEFT_PAD}${chalk.yellow("Examples:")}`);

  switch (commandName.toLowerCase()) {
    case "pr":
      console.log(`${LEFT_PAD}  /pr create Fix login bug`);
      console.log(`${LEFT_PAD}  /pr list`);
      console.log(`${LEFT_PAD}  /pr view 42`);
      break;
    case "analyze":
      console.log(`${LEFT_PAD}  /analyze app/page.tsx`);
      console.log(`${LEFT_PAD}  /analyze components/ui/button.tsx`);
      break;
    case "audit":
      console.log(`${LEFT_PAD}  /audit`);
      console.log(`${LEFT_PAD}  /audit app/api`);
      break;
    case "diff":
      console.log(`${LEFT_PAD}  /diff show`);
      console.log(`${LEFT_PAD}  /diff show app/page.tsx`);
      console.log(`${LEFT_PAD}  /diff stage app/page.tsx`);
      break;
    case "snippet":
      console.log(`${LEFT_PAD}  /snippet save auth-helper`);
      console.log(`${LEFT_PAD}  /snippet list`);
      console.log(`${LEFT_PAD}  /snippet load auth-helper`);
      break;
    default:
      console.log(`${LEFT_PAD}  ${cmd.usage}`);
  }

  console.log();
  console.log(`${LEFT_PAD}${"-".repeat(50)}`);
}

/**
 * Handle help commands
 * @param {string[]} args - Command arguments
 * @returns {string} Result message
 */
export function handleHelpCommand(args) {
  const command = args[0];

  if (command) {
    showCommandHelp(command);
    return `Help for /${command}`;
  } else {
    showGeneralHelp();
    return "Help displayed";
  }
}
