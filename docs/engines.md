# ETHUB Core Engines Documentation (Surgical & Return v2.1)

The ETHUB-CLI delegates logic to highly specialized module engines within the `core/` directory. This modular approach ensures **Isolation**, **Integrity**, and **Security**.

## 1. Surgical Action Engine (`surgical_engine.py`)
- **Responsibility:** Executes surgical directory-level operations (list, read, patch).
- **Mechanism**:
    - **Integrity**: Every file action includes a mandatory SHA256 integrity check using `hashlib`.
    - **Snapshot Protocol**: Automatically creates `.bak` backups in `.ethub/snapshots/` before any write operation.
    - **Isolation**: Strictly enforces path-awareness, restricting all actions to the current project root.
    - **Sanitization**: Thoroughly strips `<script>` and `<style>` tags from all incoming web content.

## 2. Return & Recovery Engine (`return_engine.py`)
- **Responsibility**: Manages unified system restoration and rollback.
- **Mechanism**:
    - **Capture Point**: Creates a point-in-time manifest of all agent-data (history, memory, etc.) and links them to specific SHA256 hashes.
    - **Restore**: Restores the entire agent state to a previous Point ID from `.ethub/history/`.
    - **Rollback**: Specifically reverts individual surgical fixes using the `.bak` snapshot system.

## 3. Reasoning Engine (`reasoning_engine.py`)
- **Responsibility**: Classifies and analyzes user request intent for the Hybrid Pipeline.
- **Mechanism**: Uses a local LLM to classify queries into specialized categories: `surgical_fix`, `return_recovery`, `code_query`, `hardware_query`, or `general_query`.

## 4. Safety Engine (`safety_engine.py`)
- **Responsibility**: Serves as a 9-point security firewall.
- **Mechanism**: 
    - **Surgical Audit**: Dedicated method to audit proposed `FIX_CMDS` and `DIFF_PATCH` for dangerous patterns (e.g., `rm -rf /`, `/etc/shadow`).
    - **Standard Audits**: Checks domain validity, prompt injection, and file traversal attempts.
    - Logs all blocked operations in `agent-data/dependabot-risks.json`.

## 5. Hybrid Engine (`hybrid_engine.py`)
- **Responsibility**: Orchestrates the "Reason -> Knowledge -> Action" pipeline.
- **Mechanism**: Combines local training data (RAG) with real-time intent analysis and the **Return Engine** to suggest the safest and most accurate actions.

## 6. Config Engine (`config_engine.py`)
- **Responsibility**: Manages engine parameters and application preferences.
- **Mechanism**: Synchronizes updates to `agent-data/config.json`, including search engines, timeouts, and model selection.

## 7. Helper Engine (`helper_engine.py`)
- **Responsibility**: Provides terminal UI formatting and system queries.
- **Mechanism**: Exposes `sysinfo` for hardware details and `format_box` for high-density console output.

## 8. Web Server (`web_server.py`)
- **Responsibility**: Hosts the **Surgical Management Dashboard**.
- **Mechanism**: Provides an ARIA-compliant REST API for live console preview, engine deep-dive insights, and manual system actions (Capture, Restore, Rollback).
