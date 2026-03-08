# ETHUB-CLI: Surgical Action Engine Documentation

## Overview
The **Ethub Surgical Skill** is a high-integrity automation suite designed for Termux/Linux environments. It provides surgical file operations, automated snapshotting for recovery, and SHA256 integrity verification.

## Core Components

### 1. `EthubActionEngine`
Located in `scripts/ethub_action_engine.py`.
- **Isolation**: Restricts all operations to the project root.
- **Integrity**: Calculates SHA256 hashes before and after writes.
- **Snapshots**: Automatically backs up files to `.ethub/snapshots/` before modification.
- **Methods**: `list_files()`, `read_target()`, `apply_patch()`, `create_snapshot()`, `get_sha256()`.

### 2. `EthubSurgicalEngine`
Located in `scripts/ethub_action_engine.py`.
- **Semantic Formatting**: Standardizes responses using Field Identifiers.
- **Labels**: `REASON`, `FIX_CMDS`, `SNIPPET`, `DIFF_PATCH`, `KEY POINTS`, `SOLUTION`.

### 3. `ethub_cli.py`
The main CLI interface.
- **Commands**:
  - `action --list`: Lists files with SHA256 hashes.
  - `action --read <path>`: Displays content and integrity metadata.
  - `action --patch <path> --diff <content>`: Applies a surgical fix.
  - `fix "<error>"`: Triggers the debugging protocol.
  - `search "<query>"`: Fetches technical context.
  - `explain <path>`: Breaks down file logic.

## Integrity & Recovery
- **Snapshot Location**: `.ethub/snapshots/`
- **Snapshot Format**: `<filename>_<timestamp>.bak`
- **Verification**: The engine compares SHA256 hashes to ensure "Zero-Corruption" during write operations.

## Testing
A validation suite is provided in `scripts/test_engine.py`. 
Run it via:
```bash
cd skills/ethub-surgical/scripts && python3 test_engine.py
```

## Security Protocols
- **Read-Before-Write**: Mandatory context gathering.
- **Path Allowlists**: Prevents `../` directory traversal.
- **Non-Interactive**: Optimized for CLI agent execution.
