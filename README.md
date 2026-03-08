# 🌈 ETHUB CLI: The Autonomous Terminal Powerhouse

Welcome to the new era of **ETHUB CLI**. We've transformed a simple script into a sophisticated, modular AI agent capable of deep web research, smart configuration, and interactive terminal operations—all powered by your local **Ollama** instance.

---

## 🚀 What's New? (The "New Changes" Brochure)

### 🧠 Intelligent Terminal Mode
Stop using simple prompts. Enter a full interactive shell with `python3 ethub_cli.py -i`. It features a command-driven interface (`/help`, `/settings`, `/search`) that blends traditional CLI power with LLM reasoning.

### ⚙️ Persistent Configuration Engine
Your settings now stay with you. Change your model, API endpoints, or search behavior on the fly. The new `ConfigEngine` ensures your preferences are saved in `agent-data/config.json`.

### 🔍 Smart Web Search & Fetch
The agent doesn't just "search"—it analyzes. It can browse the web using DuckDuckGo, extract relevant snippets, and even "fetch" full page content to build its own knowledge base before answering.

### 🎨 Rainbow UI & Helper Suite
Experience a "living" terminal. With the new `HelperEngine` and `RainbowAnimation`, ETHUB provides beautiful boxed layouts, color-coded status updates, and a vibrant animated intro.

### 🤖 Ollama Integration
Deep integration with Ollama allows you to manage models directly from the CLI. Use `/ollama pull` to download new brains for your agent without leaving the terminal.

---

## 🛠 Installation & Setup

1. **Prerequisites:**
   - Python 3.8+
   - [Ollama](https://ollama.ai/) installed and running.
   - A local model pulled (default is `qwen2.5:0.5b`).

2. **Launch:**
   ```bash
   # Start in interactive mode
   python3 ethub_cli.py -i

   # Run a single query
   python3 ethub_cli.py "How do I optimize Python loops?"
   ```

---

## ⌨️ Command Reference (Terminal Mode)

Inside the interactive shell (`ETHUB>`), use these slash commands:

| Command | Description | Example |
| :--- | :--- | :--- |
| `/help` | Display the command help box | `/help` |
| `/settings` | View current JSON configuration | `/settings` |
| `/set` | Update a configuration value | `/set model llama3` |
| `/search` | Perform a manual web search | `/search latest eth price` |
| `/sysinfo` | Show OS and terminal diagnostics | `/sysinfo` |
| `/ollama` | Manage local Ollama models | `/ollama pull deepseek-coder` |
| `/clear` | Clear the terminal screen | `/clear` |
| `/exit` | Gracefully close the session | `/exit` |

---

## 📂 Project Structure

- `ethub_cli.py`: The main entry point and agent loop.
- `core/`:
    - `config_engine.py`: Handles JSON settings and persistence.
    - `helper_engine.py`: UI formatting, colors, and system utilities.
- `ui/`:
    - `rainbow_animation.py`: The visual "flair" and header logic.
- `agent-data/`: Stores your logs, history, and configuration.

---

## 🔧 Technical Configuration

You can manually edit `agent-data/config.json` or use the `/set` command. Key keys include:
- `model`: The Ollama model name.
- `ollama_url`: The API endpoint (default: `http://127.0.0.1:11434/api/chat`).
- `max_steps`: How many "thoughts" the agent can have per query.

---

*“ETHUB CLI: Bringing the power of autonomous research to your fingertips.”*
