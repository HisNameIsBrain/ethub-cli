# ETHUB CLI

ETHUB CLI is a versatile tool for managing training data, persistent memory, code snippets, and smart web searching with an integrated shell-like environment.

## Features

### 1. Interactive Shell Mode
Start the CLI without arguments to enter the interactive mode:
```bash
python3 ethub_cli.py
```
This mode includes:
- **ANSI Intro Animation**: Plays on startup.
- **Forward-Only Navigation**: Use `cd` to move into subdirectories. The CLI prevents moving above the project root for security.
- **Shell Commands**:
    - `ls`: List files.
    - `cd <dir>`: Change directory (forward only).
    - `cp <src> <dst>`: Copy files.
    - `mv <src> <dst>`: Move/Rename files.
    - `co <file>`: View file content (alias for `cat`).
    - `rm <file/dir>`: Remove files or directories.
- **Command Approval Workflow**: Every shell command requires approval. You can **[a]pprove**, **[d]eny**, or **[e]dit** the command before execution.

### 2. Smart Search & Auto-Data Capture
Type any non-command request to trigger a Smart Search:
- **Auto-Snippet Extraction**: Code blocks in your requests (or future AI responses) are automatically saved to `snippets.json`.
- **Memory Tracking**: Every request is logged in `memory.json`.
- **Training Integration**: Satisfactory results and snippets are saved to `training.json` with metadata.
- **Debug Mode**: Automatically detects error traces and searches for safe solutions on Stack Overflow and GitHub.

### 3. Integrated Audit System
File changes can be audited using a unified diff view before being applied (integrated into the workflow).

## Available CLI Commands
These can be used directly from the terminal or inside the interactive shell:
- `init`: Initialize project structure.
- `train`: Manage training data.
- `memory`: Manage persistent memory.
- `snippets`: Manage code snippets.
- `rollback`: Revert the last data modification.
- `search <engine> <query>`: Direct engine search.

## Documentation
Detailed command documentation is available in `docs/commands/`.
