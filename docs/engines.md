# ETHUB Core Engines Documentation

The ETHUB CLI delegates logic to highly specialized module engines within the `core/` directory. This modular approach allows for robust testing, straightforward extensibility, and maintainability.

## 1. Action Engine (`action_engine.py`)
- **Responsibility:** Determines the most effective web search strategy.
- **Mechanism:** Uses a local LLM prompt via Ollama to map a derived reasoning intent to specific online sources (e.g., GitHub, StackOverflow, Dev.to). Includes an offline fallback.

## 2. Approval Engine (`approval_engine.py`)
- **Responsibility:** Serves as a manual security gate.
- **Mechanism:** Prompts the user interactively before high-impact operations are executed. Logs all approvals and denials persistently in `approvals.json` for auditing.

## 3. Config Engine (`config_engine.py`)
- **Responsibility:** Manages global state and application preferences.
- **Mechanism:** Maintains defaults (like `timeout`, `model`, `ollama_url`) and syncs updates to `agent-data/config.json`. Exposes `get()` and `set()` APIs for dynamic runtime configuration.

## 4. Helper Engine (`helper_engine.py`)
- **Responsibility:** Handles formatting, terminal UI, and system queries.
- **Mechanism:** Provides methods for colored console output, formatted UI boxes, terminal clearing, and accessing OS-level details (`sysinfo`).

## 5. Patch Engine (`patch_engine.py`)
- **Responsibility:** Generates and safely applies code diffs.
- **Mechanism:** Integrates `difflib` to produce unified diffs between old and new code states. Runs generated patches through the `SafetyEngine` before giving the green light for `apply_patch` to execute file I/O.

## 6. Reasoning Engine (`reasoning_engine.py`)
- **Responsibility:** Classifies and deeply analyzes user requests.
- **Mechanism:** Forwards the raw user query to Ollama to classify it as a `code_query`, `hardware_query`, or `general_query`, extracting intents and keywords to inform downstream routing.

## 7. Safety Engine (`safety_engine.py`)
- **Responsibility:** Serves as an aggressive 8-point security firewall.
- **Mechanism:** Checks inbound and outbound operations against specific rules, such as:
  1. Validating source domains.
  2. Inspecting HTML for hidden scripts.
  3. Denying dangerous Python commands (e.g., `exec`, `eval`).
  4. Detecting prompt injection attempts.
  5. Monitoring for environment or secret-key harvesting.
  6. Enforcing safe package manager source requests.
  7. Flagging unsafe shell piping.
  8. Checking for file traversal attacks (`../`, `/etc/passwd`).
  Logs blocked operations into `agent-data/dependabot-risks.json`.

## 8. Search Engine (`search_engine.py`)
- **Responsibility:** Orchestrates web-browser-based searches and logs history.
- **Mechanism:** Maps platform targets (Google, GitHub, Wiki) to specific search URL schemas, opens default browsers, and keeps an audit trail in `results.json`.

## 9. Snapshot Engine (`snapshot_engine.py`)
- **Responsibility:** Manages state history and safe reversions.
- **Mechanism:** Creates full-directory snapshots of all `.json` files in `agent-data` before major operations. Exposes a `rollback` mechanism to revert back to a previous state, preventing catastrophic data loss.
