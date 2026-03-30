# Cornell Change Notes - ETHUB Skills + Live Dashboard

Date: 2026-03-30 (UTC)
Scope: `src/cli/ethub_cli.js`, `web_debug/index_server.mjs`, `web_debug/index.html`

## Cornell Notes Layout

| Cue / Question | Notes (Exact Line-Scoped Changes) |
|---|---|
| What constants and safety policy were added to CLI? | `src/cli/ethub_cli.js:16-23` adds `SKILLS_PATH`, `ARTIFACTS_ROOT`, runtime paths, and command/output limits. `src/cli/ethub_cli.js:23-47` defines allowlisted executable commands. `src/cli/ethub_cli.js:76` blocks shell operator injection via `BLOCKED_COMMAND_PATTERN`. |
| How are artifact snippets mined without external unzip execution? | `src/cli/ethub_cli.js:262-324` adds in-process ZIP parsing (`extractTextEntriesFromZip`) using EOCD + central directory + inflateRaw, removing dependency on child `unzip` execution. |
| How are snippets filtered and normalized? | `src/cli/ethub_cli.js:194-208` adds normalization + heuristic filtering (`looksLikeUsefulSnippet`). `src/cli/ethub_cli.js:547-608` extracts snippets from fenced blocks and shell-like lines, including JSON conversation traversal. |
| Where is the artifact mining pipeline? | `src/cli/ethub_cli.js:634-733` implements `collectSkillCandidatesFromArtifacts(limit)` with candidate ranking, dedupe, safety tagging, and `skills_mined` event logging. |
| Where is secure skill validation? | `src/cli/ethub_cli.js:747-791` validates path tokens and command safety (single-line only, allowlist only, path stays inside workspace, disallow absolute/traversal/meta shell operators). |
| Where is skill execution with bounded runtime/output? | `src/cli/ethub_cli.js:793-865` runs approved command with `spawn(..., shell:false)`, 120s timeout, output cap, and structured `skill_run_complete` logging. |
| Where are dashboard auto-power changes in CLI? | `src/cli/ethub_cli.js:867-915` adds runtime discovery + health check + detached spawn for dashboard server. `src/cli/ethub_cli.js:917-933` starts dashboard before CLI UI and prints dashboard URL/fallback message. |
| Where are CLI skill commands exposed? | `src/cli/ethub_cli.js:1141-1143` updates `/help`. `src/cli/ethub_cli.js:1322-1459` adds `/skills mine|candidates|add|list|show|run`. |
| Where is approval wiring for skill actions? | `src/cli/ethub_cli.js:1464-1485` routes pending actions `add_skill` and `run_skill`. `src/cli/ethub_cli.js:1537-1568` persists approved skill definitions to `ethub_cli_skills.json`. |
| What changed in web debug server runtime behavior? | `web_debug/index_server.mjs:8` defaults host to `127.0.0.1` (local-first/private). `web_debug/index_server.mjs:11` adds runtime file path. `web_debug/index_server.mjs:44-70` writes/cleans `web_debug/runtime.json`. |
| What backend endpoint feeds the new dashboard data model? | `web_debug/index_server.mjs:481-569` adds `/api/ethub-insights` returning: `skills_total`, `pending_action`, `approvals`, `metrics`, `recent`, and session metadata from ETHUB logs + skills file. |
| Where is dashboard runtime metadata persisted? | `web_debug/index_server.mjs:652-659` writes runtime data after bind. `web_debug/index_server.mjs:666-678` cleanup on `SIGINT`/`SIGTERM`/`exit`. |
| What frontend design/data changes were added? | `web_debug/index.html:221-308` adds live dashboard visual style (cards, pulse indicator, event strip). `web_debug/index.html:423-450` adds ETHUB live panel in UI. `web_debug/index.html:467-472, 481-491` adds new state/DOM bindings. |
| Where is live metrics polling + auto-open flow? | `web_debug/index.html:687-710` adds `pollEthubInsights()` render/update logic. `web_debug/index.html:702-706` auto-opens latest ETHUB session when live data exists. `web_debug/index.html:821-823` starts recurring insights poll. |
| Where is docs visibility from dashboard improved? | `web_debug/index.html:388` adds `Open Cornell Change Notes` button. `web_debug/index.html:652-679` (`openCornellNotes`) loads docs source + this file through existing read pipeline. `web_debug/index.html:768` wires button event. |

## Summary (Cornell Bottom Section)

This change set introduced a secure, approval-gated skill system in ETHUB CLI, a deterministic artifact snippet miner, dashboard auto-boot/runtime discovery, and a new live dashboard panel/data model for skills + approvals. The design keeps execution constrained by command allowlist, path restrictions, no-shell spawning, and explicit `/yes` approval gating before state-changing skill actions.

## Logs Moved Into This Doc (Snapshot)

### A) Latest CLI boot session (`session_20260330_121044_829`)
Source: `ethub_cli_session_logs/session_20260330_121044_829/events.jsonl`

```json
{"index":1,"ts":"2026-03-30T12:10:44.833Z","type":"session_start","payload":{"app":"ethub-cli-agent","started_at":"2026-03-30T12:10:44.833Z","session_dir":"/root/ethub-cli/ethub_cli_session_logs/session_20260330_121044_829","cwd":"/root/ethub-cli","node":"v24.14.0","platform":"linux 6.8.0-106-generic","ollama_url":"http://127.0.0.1:11434/api/chat","model_default":"qwen2.5:0.5b"}}
{"index":3,"ts":"2026-03-30T12:10:44.838Z","type":"dashboard_boot","payload":{"started":true,"path":"/root/ethub-cli/web_debug/index_server.mjs"}}
{"index":24,"ts":"2026-03-30T12:10:49.088Z","type":"session_end","payload":{"ended_at":"2026-03-30T12:10:49.088Z"}}
```

### B) Skills workflow proof session (`session_20260330_120232_088`)
Source: `ethub_cli_session_logs/session_20260330_120232_088/events.jsonl`

```json
{"index":22,"ts":"2026-03-30T12:02:43.220Z","type":"skills_mined","payload":{"candidates":1,"unique_snippets":9299,"scanned_sources":14,"zip_files":1}}
{"index":31,"ts":"2026-03-30T12:03:18.563Z","type":"action_queued","payload":{"action_id":"act_1774872198563","type":"add_skill","payload":{"skill_name":"checkstatus","source_candidate":"cand_1","snippet":"git status","executable":true}}}
{"index":36,"ts":"2026-03-30T12:03:18.564Z","type":"approval","payload":{"action_id":"act_1774872198563","approved":true}}
{"index":38,"ts":"2026-03-30T12:03:18.565Z","type":"skill_added","payload":{"action_id":"act_1774872198563","skill_id":"skill_1774872198564","skill_name":"checkstatus","executable":true}}
{"index":44,"ts":"2026-03-30T12:03:18.566Z","type":"action_queued","payload":{"action_id":"act_1774872198566","type":"run_skill","payload":{"skill_id":"skill_1774872198564","skill_name":"checkstatus","snippet":"git status"}}}
{"index":49,"ts":"2026-03-30T12:03:18.566Z","type":"approval","payload":{"action_id":"act_1774872198566","approved":true}}
```

### C) Current skills file state
Source: `ethub_cli_skills.json`

```json
{"updated_at":"2026-03-30T12:10:38Z","skills":[]}
```

### D) Runtime dashboard file state at doc generation time
Source: `web_debug/runtime.json`

```json
{"runtime":"not_running"}
```

## How To Open This In Dashboard

1. Open `web_debug` dashboard.
2. Click `Open Cornell Change Notes`.
3. Dashboard loads this file through source `docs`.
