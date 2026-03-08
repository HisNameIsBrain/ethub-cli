---
name: ethub-surgical
description: High-integrity, isolated surgical operations for ETHUB-CLI. Use when Gemini CLI needs to perform directory-level file modifications, error debugging with Semantic Labels, or context gathering using Linux primitives.
---

# Ethub Surgical Skill

This skill provides a high-density, isolated environment for directory-level operations within ETHUB-CLI projects. It prioritizes **integrity**, **isolation**, and **precision**.

## Core Mandates

1. **Isolation**: All core logic resides in `scripts/ethub_cli.py`. Do NOT use external node scripts for project management.
2. **Integrity-First**: Every [WRITE] action must follow the **Snapshot Protocol**.
    - Before writing, call `ethub action --read <file>` to verify current SHA256 and content.
    - A snapshot is automatically created in `.ethub/snapshots/` by the engine.
3. **Semantic Hierarchy**: Responses for debugging or code modifications MUST follow the **Surgical Formatting Hierarchy**.

## Surgical Workflows

### 🛠️ Debugging Protocol
When a user presents an error or stack trace:
1. **Analyze**: Identify the technical "why".
2. **Search**: Use `ethub search "<error>"` to find the `REASON` and `FIX_CMDS`.
3. **Draft Fix**: Generate a surgical `DIFF_PATCH`.
4. **Format**: Output using the following labels:
    - `REASON`: [FIELD: ERROR_ROOT_CAUSE]
    - `FIX_CMDS`: [FIELD: RESOLUTION_SHELL]
    - `SNIPPET`: [FIELD: FIXED_MODULE]
    - `DIFF_PATCH`: [FIELD: GIT_UNIFIED_DIFF]

### 🏗️ Directory Actions
For direct file manipulations:
- **List Files**: `ethub action --list` (returns files with SHA256 hashes).
- **Read File**: `ethub action --read <path>` (returns content + full integrity hash).
- **Apply Patch**: `ethub action --patch <path> --diff <content>`.
- **Dry-Run**: Always use `ethub action --patch <path> --diff <content> --dry-run` first to simulate the change.

### 📝 General Inquiries
For simple technical questions:
- Use bulleted chunks for `KEY POINTS`.
- Provide a clear `SOLUTION` code block.

## Security & Guardrails
- **Zero-Migration**: Never trigger environment updates or database migrations unless explicitly requested.
- **Path Isolation**: The engine restricts all actions to the current project root to prevent sensitive system directory access.
- **Read-Before-Write**: Always read a file's context before proposing any write action.

## Tool Integration
The skill leverages standard Linux commands like `sha256sum`, `stat`, and `ls` via the `EthubActionEngine` to provide "valuable details from context".
