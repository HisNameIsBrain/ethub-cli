# ETHUB CLI

ETHUB CLI is a versatile tool for managing training data, persistent memory, and code snippets. It's designed to be isolated and self-contained.

## Installation

Ensure you have Python 3.x installed. You can run the CLI directly:

```bash
python3 ethub_cli.py [command]
```

To make it easier, you can alias it:

```bash
alias ethub-cli='python3 /path/to/ethub_cli.py'
```

## Getting Started

First, initialize the project structure:

```bash
python3 ethub_cli.py init
```

This creates the necessary `data/`, `training/`, and `docs/` directories.

## Available Commands

- **init**: Initialize the project structure and data files.
- **train**: Manage training data.
    - `add "<text>"`: Add a new training entry.
    - `list`: List all training entries.
    - `clear`: Clear all training data.
- **memory**: Manage persistent memory.
    - `save <key> <value>`: Save a key-value pair to memory.
    - `get <key>`: Retrieve a value from memory.
    - `list`: List all memory entries.
    - `clear`: Clear all memory.
- **snippets**: Manage code snippets.
    - `add <name> "<code>"`: Add a new snippet.
    - `get <name>`: Retrieve a snippet by name.
    - `list`: List all snippet names.
    - `clear`: Clear all snippets.

Detailed documentation for each command can be found in the `docs/commands/` directory.
