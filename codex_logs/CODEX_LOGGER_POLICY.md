# Codex Logger Policy

Codex history in this repository is logger-only and separate from ETHUB CLI runtime.

## Requirements
- Keep Codex logs separate from ETHUB CLI logic.
- Store logs as append-only files.
- Do not delete existing logs.
- Do not overwrite existing session files.
- If a file hits 2,000 lines, create a new part file and continue logging there.

## Naming Recommendation
- `codex_session_<session_id>_part001.jsonl`
- `codex_session_<session_id>_part002.jsonl`
- `codex_session_<session_id>.meta.json`
