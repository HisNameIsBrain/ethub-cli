/**
 * @file snippets.mjs
 * @description Code snippet management for ETHUB CLI
 * @module cli/commands/snippets
 * 
 * WHY: Reusable code snippets improve development speed and consistency
 * WHAT: Save, list, load, and delete code snippets
 * WHERE: Stored in scripts/cli/snippets directory
 
import { LEFT_PAD } from "../helpers/colors.mjs";
import { showAction, showSuccess, showError, showReasoningStep, displayCode } from "../helpers/thinking.mjs";
import { confirm, promptInput } from "../helpers/readline.mjs";
import { SNIPPETS_DIR } from "../config.mjs";

/* ======================================================
   SNIPPET STORAGE
   ====================================================== */

/**
 * Ensure snippets directory exists
 */
function ensureSnippetsDir() {
  if (!existsSync(SNIPPETS_DIR)) {
    mkdirSync(SNIPPETS_DIR, { recursive: true });
  }
}

/**
 * Get snippet file path
 * @param {string} name - Snippet name
 * @returns {string} Full path
 */
function getSnippetPath(name) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(SNIPPETS_DIR, `${safeName}.json`);
}

/**
 * Save a code snippet
 * @param {string} name - Snippet name
 * @param {string} code - Code content
 * @param {object} metadata - Additional metadata
 * @returns {{success: boolean, error?: string}}
 */
export function saveSnippet(name, code, metadata = {}) {
  ensureSnippetsDir();

  const snippet = {
    name,
    code,
    language: metadata.language || "typescript",
    description: metadata.description || "",
    tags: metadata.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const filePath = getSnippetPath(name);

  // Check if exists
  if (existsSync(filePath)) {
    const existing = JSON.parse(readFileSync(filePath, "utf-8"));
    snippet.createdAt = existing.createdAt;
  }

  try {
    writeFileSync(filePath, JSON.stringify(snippet, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Load a code snippet
 * @param {string} name - Snippet name
 * @returns {{success: boolean, snippet?: object, error?: string}}
 */
export function loadSnippet(name) {
  const filePath = getSnippetPath(name);

  if (!existsSync(filePath)) {
    return { success: false, error: `Snippet not found: ${name}` };
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const snippet = JSON.parse(content);
    return { success: true, snippet };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * List all snippets
 * @returns {{success: boolean, snippets?: Array, error?: string}}
 */
export function listSnippets() {
  ensureSnippetsDir();

  try {
    const files = readdirSync(SNIPPETS_DIR).filter(f => f.endsWith(".json"));
    const snippets = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(SNIPPETS_DIR, file), "utf-8");
        const snippet = JSON.parse(content);
        snippets.push({
          name: snippet.name,
          language: snippet.language,
          description: snippet.description,
          createdAt: snippet.createdAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    return { success: true, snippets };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a snippet
 * @param {string} name - Snippet name
 * @returns {{success: boolean, error?: string}}
 */
export function deleteSnippet(name) {
  const filePath = getSnippetPath(name);

  if (!existsSync(filePath)) {
    return { success: false, error: `Snippet not found: ${name}` };
  }

  try {
    unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Handle snippet commands
 * @param {string[]} args - Command arguments
 * @returns {Promise<string>} Result message
 */
export async function handleSnippetCommand(args) {
  const subcommand = args[0]?.toLowerCase();
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "save": {
      const name = subArgs[0];
      if (!name) {
        showError("Please specify a name: /snippet save <name>");
        return "Missing snippet name";
      }

      showAction("Save Snippet", name);
      showReasoningStep("Enter code (paste and press Enter twice to finish)", 1);

      console.log(`${LEFT_PAD}${chalk.gray("Paste your code below (Enter twice to finish):")}`);

      // Collect multi-line input
      let code = "";
      let emptyLines = 0;

      while (emptyLines < 2) {
        const line = await promptInput(chalk.dim("  > "));
        if (line === null) break; // Ctrl+C

        if (line === "") {
          emptyLines++;
          if (emptyLines < 2) code += "\n";
        } else {
          emptyLines = 0;
          code += line + "\n";
        }
      }

      code = code.trim();

      if (!code) {
        showError("No code provided");
        return "Empty snippet";
      }

      // Ask for description
      const description = await promptInput(`${LEFT_PAD}${chalk.gray("Description (optional):")} `);

      // Ask for language
      const language = await promptInput(`${LEFT_PAD}${chalk.gray("Language [typescript]:")} `) || "typescript";

      const result = saveSnippet(name, code, { description, language });

      if (result.success) {
        showSuccess(`Saved snippet: ${name}`);
        return `Snippet "${name}" saved`;
      } else {
        showError(result.error);
        return result.error;
      }
    }

    case "load":
    case "get": {
      const name = subArgs[0];
      if (!name) {
        showError("Please specify a name: /snippet load <name>");
        return "Missing snippet name";
      }

      showAction("Load Snippet", name);

      const result = loadSnippet(name);

      if (!result.success) {
        showError(result.error);
        return result.error;
      }

      const s = result.snippet;
      console.log();
      console.log(`${LEFT_PAD}${chalk.cyan.bold(s.name)}`);
      if (s.description) {
        console.log(`${LEFT_PAD}${chalk.gray(s.description)}`);
      }
      console.log();
      displayCode(s.code, s.language);

      showSuccess(`Loaded snippet: ${name}`);
      return s.code;
    }

    case "list":
    case "ls": {
      showAction("List Snippets");

      const result = listSnippets();

      if (!result.success) {
        showError(result.error);
        return result.error;
      }

      if (result.snippets.length === 0) {
        showSuccess("No snippets saved yet");
        return "No snippets";
      }

      console.log();
      console.log(`${LEFT_PAD}${chalk.cyan.bold("Saved Snippets:")}`);
      for (const s of result.snippets) {
        console.log(`${LEFT_PAD}  ${chalk.cyan(s.name)} ${chalk.dim(`[${s.language}]`)}`);
        if (s.description) {
          console.log(`${LEFT_PAD}    ${chalk.gray(s.description)}`);
        }
      }

      showSuccess(`Found ${result.snippets.length} snippets`);
      return `${result.snippets.length} snippets`;
    }

    case "delete":
    case "rm": {
      const name = subArgs[0];
      if (!name) {
        showError("Please specify a name: /snippet delete <name>");
        return "Missing snippet name";
      }

      showAction("Delete Snippet", name);

      const proceed = await confirm(`Delete snippet "${name}"?`, false);
      if (!proceed) {
        showSuccess("Cancelled");
        return "Cancelled";
      }

      const result = deleteSnippet(name);

      if (result.success) {
        showSuccess(`Deleted snippet: ${name}`);
        return `Deleted "${name}"`;
      } else {
        showError(result.error);
        return result.error;
      }
    }

    default:
      return `Unknown snippet command: ${subcommand}. Try: save, load, list, delete`;
  }
}
