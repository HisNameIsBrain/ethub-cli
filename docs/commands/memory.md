# `memory` Command

Manage persistent memory for ETHUB CLI.

## Purpose

The `memory` command allows you to save, get, list, and clear memory entries. This data is stored in a `memory.json` file in the `data/` directory.

## Specifications

- **Command Name:** `memory`
- **Subcommands:** `save`, `get`, `list`, `clear`
- **Arguments:**
    - `save <key> <value>`: The memory key and value.
    - `get <key>`: The memory key to retrieve.
- **Options:** None
- **Dependencies:** `python3 ethub_cli.py init` must be run first.

## Subcommands

### `save`

Save a key-value pair to memory.

#### Input

```bash
python3 ethub_cli.py memory save key value
```

#### Output

- Success message: `Saved to memory: key -> value`

---

### `get`

Retrieve a value from memory.

#### Input

```bash
python3 ethub_cli.py memory get key
```

#### Output

- Displays the value associated with the key.
- If not found: `Key 'key' not found in memory.`

---

### `list`

List all memory entries.

#### Input

```bash
python3 ethub_cli.py memory list
```

#### Output

- Displays all key-value pairs stored in memory.
- If empty: `Memory is empty.`

---

### `clear`

Clear all memory.

#### Input

```bash
python3 ethub_cli.py memory clear
```

#### Output

- Success message: `Memory cleared.`

## Examples

### Save a memory key-value pair

```bash
python3 ethub_cli.py memory save username ethub_user
```

### Retrieve a value by key

```bash
python3 ethub_cli.py memory get username
```

### List all memory entries

```bash
python3 ethub_cli.py memory list
```

### Clear all memory

```bash
python3 ethub_cli.py memory clear
```

Use the `memory` command to persist key information across different sessions.
