# ethub-cli

`ethub-cli` is a local terminal assistant CLI that talks to a local Ollama server.

## Quick Start (60 seconds)

```bash
# 1) Start Ollama and pull a model
ollama pull qwen2.5:0.5b

# 2) Install and link this CLI
cd /root/ethub-cli
npm install
npm link

# 3) Run
ethub-cli
```

Optional:

```bash
ethub cli
dashboard debug
```

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm
- Ollama installed and running

## 1) Set Up Ollama

Install Ollama (Linux/macOS/Windows) from:

- https://ollama.com/download

Start Ollama, then pull at least one model (example uses `qwen2.5:0.5b`):

```bash
ollama pull qwen2.5:0.5b
```

Verify Ollama is running:

```bash
curl http://127.0.0.1:11434/api/tags
```

Expected: JSON response with available models.

Optional environment overrides:

```bash
export OLLAMA_URL="http://127.0.0.1:11434/api/chat"
export OLLAMA_MODEL="qwen2.5:0.5b"
```

## 2) Set Up ethub-cli

From this repo:

```bash
cd /root/ethub-cli
npm install
npm link
```

This exposes these commands globally:

- `ethub`
- `ethub-cli`
- `dashboard`

If you do not want global linking, you can run directly:

```bash
node ethub_cli.js
```

## 3) Run

Start CLI:

```bash
ethub-cli
```

Or:

```bash
ethub cli
```

Open dashboard server:

```bash
dashboard debug
```

Or:

```bash
ethub-cli dashboard debug
```

## 4) Common Commands

Inside `ethub-cli`:

- `/help`
- `/status`
- `/model <name>`
- `/approve changes on`
- `/skills mine 10`

## Troubleshooting

- `Ollama request failed`:
  - Make sure Ollama is running.
  - Confirm `OLLAMA_URL` points to the chat endpoint.
- `model not found`:
  - Pull the model first: `ollama pull <model>`
  - Set `OLLAMA_MODEL=<model>`
- command not found (`ethub-cli`):
  - Re-run `npm link`
  - Or run with `node ethub_cli.js`
