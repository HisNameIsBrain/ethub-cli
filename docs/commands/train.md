# `train` Command

Manage training data entries for ETHUB CLI.

## Purpose

The `train` command allows you to add, list, and clear training data. This data is stored in a `training.json` file in the `data/` directory.

## Specifications

- **Command Name:** `train`
- **Subcommands:** `add`, `list`, `clear`
- **Arguments:**
    - `add <text>`: The training text to add.
- **Options:** None
- **Dependencies:** `python3 ethub_cli.py init` must be run first.

## Subcommands

### `add`

Add a new training entry.

#### Input

```bash
python3 ethub_cli.py train add "Training entry content"
```

#### Output

- Success message: `Added training entry: Training entry content`

---

### `list`

List all training entries.

#### Input

```bash
python3 ethub_cli.py train list
```

#### Output

- Displays a numbered list of all training entries.
- If empty: `No training data found.`

---

### `clear`

Clear all training data.

#### Input

```bash
python3 ethub_cli.py train clear
```

#### Output

- Success message: `Training data cleared.`

## Examples

### Add a new training entry

```bash
python3 ethub_cli.py train add "New training entry"
```

### List all training entries

```bash
python3 ethub_cli.py train list
```

### Clear all training data

```bash
python3 ethub_cli.py train clear
```

Use the `train` command to feed manual data to ETHUB CLI for its training processes.
