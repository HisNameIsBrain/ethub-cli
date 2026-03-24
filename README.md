# ETHUB CLI + Codex Logs (Current State)

## Before vs After

### Before
- Codex logging had runner/server tooling paths introduced during iteration.
- Debug viewing and session-capture logic were mixed into temporary tooling attempts.
- Documentation existed but did not clearly summarize current final state.

### After (Current)
- `ethub_cli.js` is ETHUB CLI only (Ollama-only runtime).
- Codex logs are file-based and separate under `codex_logs/`.
- Added safe local web debug index in `web_debug/` on port `3000`.
- Existing logs/docs kept; no prior logs removed.

## Components
- `ethub_cli.js`: ETHUB terminal agent (Ollama-only).
- `web_debug/index_server.mjs`: local safe Node server for viewing logs.
- `web_debug/index.html`: web UI for ETHUB/Codex/docs file viewing.
- `codex_logs/`: Codex session log artifacts and policy.

## Run ETHUB CLI
```bash
cd /root/ethub-cli
node ethub_cli.js
```

## Run web_debug (localhost:3000)
```bash
cd /root/ethub-cli
node web_debug/index_server.mjs
```

Open in browser:
- `http://127.0.0.1:3000/?token=<token_from_server_output>`

Security defaults:
- localhost bind only (`127.0.0.1`)
- token-gated API
- path traversal protections for file reads

## Codex Logs (Separate, File-Only)
Location:
- `codex_logs/*.jsonl`
- `codex_logs/*.meta.json`
- `codex_logs/CODEX_LOGGER_POLICY.md`

Rules:
- append-only updates
- keep existing logs
- do not overwrite prior session files
- when a file reaches 2,000 lines, continue in next part file

## ETHUB Logs
- `ethub_cli_session_logs/`
- `ethub_cli_change_logs/`

## Docs Index
- `docs/SESSION_2026-03-24.md`
- `docs/SESSION_2026-03-24_FILES.json`
- `docs/CODEX_LINE_CHANGES_20260324_082748.log`
- `docs/SESSION_2026-03-24_CONTINUATION_20260324_090655.md`
- `docs/SESSION_2026-03-24_CONTINUATION_20260324_090655_FILES.json`
- `docs/SESSION_2026-03-24_CONTINUATION_20260324_091352.md`

## Notes
- In this sandbox, binding local ports can fail with `EPERM`; run `web_debug` on your host environment.
