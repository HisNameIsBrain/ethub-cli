# ETHUB CLI Architecture (v2.1 Surgical)

## Overview
ETHUB CLI is an autonomous terminal-based AI agent designed for **Surgical Directory Operations**, high-integrity file management, and verifiable system recovery. It operates on a "Zero-Dependency" principle, utilizing the Python Standard Library and local Ollama models to ensure maximum security and isolation.

## Directory Structure
- **`ethub_cli.py`**: The main entry point. Orchestrates the agent loop and integrates the **Surgical Action** and **Return Recovery** tools.
- **`core/`**: Specialized engines for isolation (`EthubActionEngine`), integrity (`EthubReturnEngine`), security (`SafetyEngine`), and reasoning.
- **`ui/`**: Terminal enhancements and the **Surgical Management Dashboard** (web).
- **`agent-data/`**: Stores state, history, and training data.
- **`.ethub/`**: Persistent storage for system-wide Return manifests and Surgical snapshots.
- **`skills/`**: Formal Gemini CLI Skill definitions for surgical workflows.

## Core Flow (The Surgical Protocol)
1. **Intent Analysis**: The `ReasoningEngine` classifies the request (e.g., `surgical_fix`).
2. **Context Gathering**: The `EthubActionEngine` performs a **Read-Before-Write** context retrieval with SHA256 verification.
3. **Execution Strategy**: The agent proposes a `DIFF_PATCH` and `FIX_CMDS` using the **Surgical Formatting Hierarchy**.
4. **Security Audit**: The `SafetyEngine` performs a dedicated surgical audit on the proposed fix.
5. **Modification**: If approved, the engine creates a `.bak` snapshot and applies the patch.
6. **Integrity Verify**: The engine confirms the success of the operation via post-write SHA256 hashing.

## The Tooling Model (Semantic I/O)
The agent utilizes a structured JSON communication model with specialized tools:
- **`ethub_action`**: High-integrity file list, read, and patch operations.
- **`ethub_return`**: Unified manifest capture, state restoration, and file rollback.
- **`web_search` / `fetch_url`**: Sanitized and audited data retrieval.

### Safety & Recovery
- **Snapshot Protocol**: Automatic backups in `.ethub/snapshots/` before any directory modification.
- **Return Engine**: Point-in-time restoration of the entire agent environment via unified manifests.
- **Surgical Audit**: 9-point security firewall protecting against malicious patterns and injection.
