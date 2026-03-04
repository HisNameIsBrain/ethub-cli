# `init` Command

Initialize the ETHUB CLI project structure and data files.

## Purpose

The `init` command is intended to be run once when you first set up the ETHUB CLI or if you need to recreate the necessary directories and empty data files.

## Specifications

- **Command Name:** `init`
- **Arguments:** None
- **Options:** None
- **Dependencies:** None

## Input

```bash
python3 ethub_cli.py init
```

## Output

Upon success, it will create the following structure (if it doesn't already exist):

```text
/data/data/com.termux/files/home/new/ETHUB/scripts/
├── data/
│   ├── training.json
│   ├── memory.json
│   └── snippets.json
├── training/
└── docs/
    └── commands/
```

Success message: `ETHUB CLI project initialized successfully.`

## Examples

### Initialize the project

```bash
python3 ethub_cli.py init
```

Use this command when you're setting up the CLI for the first time or if you've accidentally deleted the `data/` directory.
