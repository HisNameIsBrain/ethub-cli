# `snippets` Command

Manage code snippets for ETHUB CLI.

## Purpose

The `snippets` command allows you to add, list, and clear snippets. This data is stored in a `snippets.json` file in the `data/` directory.

## Specifications

- **Command Name:** `snippets`
- **Subcommands:** `add`, `get`, `list`, `clear`
- **Arguments:**
    - `add <name> "<code>"`: The snippet name and the code snippet itself.
    - `get <name>`: The snippet name to retrieve.
- **Options:** None
- **Dependencies:** `python3 ethub_cli.py init` must be run first.

## Subcommands

### `add`

Add a new snippet.

#### Input

```bash
python3 ethub_cli.py snippets add "Snippet Name" "print('Hello world!')"
```

#### Output

- Success message: `Added snippet: Snippet Name`

---

### `get`

Retrieve a snippet by name.

#### Input

```bash
python3 ethub_cli.py snippets get "Snippet Name"
```

#### Output

- Displays the code snippet associated with the name.
- If not found: `Snippet 'Snippet Name' not found.`

---

### `list`

List all snippet names.

#### Input

```bash
python3 ethub_cli.py snippets list
```

#### Output

- Displays all snippet names stored in ETHUB CLI.
- If empty: `No snippets found.`

---

### `clear`

Clear all snippets.

#### Input

```bash
python3 ethub_cli.py snippets clear
```

#### Output

- Success message: `Snippets cleared.`

## Examples

### Add a new snippet

```bash
python3 ethub_cli.py snippets add "Python Hello World" "print('Hello, ETHUB!')"
```

### Retrieve a snippet by name

```bash
python3 ethub_cli.py snippets get "Python Hello World"
```

### List all snippet names

```bash
python3 ethub_cli.py snippets list
```

### Clear all snippets

```bash
python3 ethub_cli.py snippets clear
```

Use the `snippets` command to manage and reuse common code snippets effectively.
