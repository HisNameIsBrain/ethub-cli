---
name: ethub-surgical
description: High-integrity, isolated surgical operations and system recovery for ETHUB-CLI. Use when Gemini CLI needs to perform directory-level file modifications with SHA256 verification, debugging using Semantic Labels, or system state restoration.
---

# Ethub Surgical & Return Skill

This skill provides the procedural logic for **High-Density**, **Path-Aware** operations within ETHUB-CLI environments. It prioritizes **Integrity**, **Isolation**, and **Precision**.

## Core Mandates

1. **Isolation**: All logic resides in the `core/` directory. Do NOT use external or unverified scripts for project management.
2. **Integrity-First**: Every [WRITE] action must follow the **Snapshot & Integrity Protocol**.
    - Before writing, perform a `read` action to verify SHA256 and current state.
    - A snapshot is automatically created in `.ethub/snapshots/` by the engine.
3. **Semantic Hierarchy**: All debugging or code modification responses MUST use the **Surgical Formatting Hierarchy**.

## Surgical Formatting Hierarchy (Semantic Labels)

For debugging and code-related directives, use these specific Field Identifiers:

- `### [FIELD: REASON]`: Define the technical "why" behind an error.
- `### [FIELD: FIX_CMDS]`: List exact shell instructions for resolution.
- `### [FIELD: DIFF_PATCH]`: Surgical code comparison using unified diff syntax.
- `### [FIELD: SNIPPET]`: Direct code fragment relevant to the fix.
- `### [FIELD: AUDIT]`: Security audit trail of the proposed fix.
- `### [FIELD: RETURN]`: Feedback on restoration or rollback actions.

For simple technical inquiries:
- `### [FIELD: KEY POINTS]`: Bulleted chunks for listing technical facts.
- `### [FIELD: SOLUTION]`: Syntax-highlighted code block for the solution.

## Surgical Workflows

### 🛠️ Debugging Protocol
When encountering an error or stack trace:
1. **Analyze**: Identify the root cause.
2. **Search**: Find the `REASON` and `FIX_CMDS`.
3. **Audit**: Verify the fix for security risks (SafetyEngine).
4. **Draft**: Generate a surgical `DIFF_PATCH`.
5. **Format**: Output using the **Semantic Labels**.

### 🏗️ Directory Actions
For direct file manipulations:
- **List Files**: `ethub_action(sub="list")` (returns files with SHA256).
- **Read File**: `ethub_action(sub="read", target="<path>")` (content + integrity hash).
- **Apply Patch**: `ethub_action(sub="patch", target="<path>", content="<new_content>")`.

### 📝 Return & Recovery
- **Capture Point**: `return_engine.capture_point(label="<desc>")`
- **Restore Point**: `return_engine.restore_to(point_id="<id>")`
- **Rollback File**: `return_engine.rollback_surgical_fix(file_name="<name>")`

## Security & Guardrails
- **Zero-Migration**: Never trigger environment updates unless explicitly requested.
- **Path Isolation**: All actions are restricted to the project root to prevent system-wide access.
- **Read-Before-Write**: Mandatory context gathering before any [WRITE] operation.
- **HTML Sanitization**: All rich text from the web must be stripped of `<script>` and `<style>` tags.
