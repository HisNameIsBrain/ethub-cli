# ETHUB CLI Architecture

## Overview
ETHUB CLI is an autonomous terminal-based AI agent designed to interact with users, search the web, fetch content, and manage local configurations. It is designed to run completely offline without relying on external third-party Python packages like `requests`, keeping a small footprint by utilizing the Python Standard Library and local LLM models via Ollama.

## Directory Structure
- **`ethub_cli.py`**: The main entry point. It parses arguments, handles the interactive terminal mode, and maintains the core agent loop.
- **`core/`**: Houses all the specialized engines that process, analyze, and execute tasks safely.
- **`ui/`**: Contains visual enhancements like `rainbow_animation.py` for terminal graphics.
- **`agent-data/`**: Stores local state, historical data, system configuration, risk logs, and user-provided training datasets.
- **`rules/`**: Contains security constraints like `rules.json` that the `SafetyEngine` references.
- **`docs/`**: Project documentation mapping system features and internal APIs.

## Core Flow
1. **Initialization:** The CLI boots, loads the user config (`agent-data/config.json` via `ConfigEngine`), and starts either interactive mode or processes a single query.
2. **Terminal Mode:** Provides slash commands (`/help`, `/settings`, `/set`, `/search`, `/train`, `/sysinfo`, `/ollama`) to interact with the environment.
3. **Agent Loop (`ethub_cli.py`):**
   - The user's query is appended to a list of messages.
   - It is sent to the local Ollama instance (`chat_with_ollama`).
   - The AI responds with a JSON object detailing its `thought`, `action`, and `args`.
   - The loop executes the tools (`web_search`, `fetch_url`, or `final_answer`) based on the action and repeats until `final_answer` is given or max steps are reached.

## The Tooling and Communication Model
All communication between the agent logic and the reasoning models happens strictly via structured JSON objects. The agent relies heavily on an offline-first, safety-first paradigm where tasks are parsed into concrete actions and evaluated against constraints.

### The "train" mechanism
The system enables contextual fine-tuning via the `/train` command, which allows users to directly supply domain knowledge or import exported conversations from models like ChatGPT. This local knowledge base is stored in `agent-data/training.json` and enriches the agent's context.

### Safety & History (Snapshots)
A snapshot mechanism captures point-in-time backups of the system's memory, risks, and snippets (`SnapshotEngine`), allowing safe rollback mechanisms. The `SafetyEngine` operates an 8-point security audit against all content sources to mitigate vulnerabilities.
