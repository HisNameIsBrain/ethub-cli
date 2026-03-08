import os
import hashlib
import shutil
from pathlib import Path
from datetime import datetime

class EthubActionEngine:
    """
    ETHUB-CLI: Directory-level actions with Isolation & Integrity.
    Enables surgical file operations with SHA256 verification and snapshots.
    """
    def __init__(self, project_root=None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.snapshot_dir = self.project_root / ".ethub" / "snapshots"
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def _get_relative_path(self, file_name):
        """Ensures operations stay within the project root."""
        target_path = (self.project_root / file_name).resolve()
        if not str(target_path).startswith(str(self.project_root.resolve())):
            raise ValueError(f"Operation attempted outside project root: {file_name}")
        return target_path

    def get_sha256(self, file_path):
        """[FIELD: INTEGRITY_CHECK] - Calculate SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception:
            return None

    def create_snapshot(self, file_path):
        """[FIELD: SNAPSHOT_PROTOCOL] - Create a point-in-time recovery backup."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            rel_path = file_path.relative_to(self.project_root)
            snapshot_path = self.snapshot_dir / f"{rel_path}_{timestamp}.bak"
            snapshot_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, snapshot_path)
            return str(snapshot_path)
        except Exception as e:
            return f"Snapshot failed: {e}"

    def list_files(self):
        """[FIELD: FILESYSTEM_ACTION] - List entries with integrity metadata."""
        try:
            entries = []
            for f in self.project_root.iterdir():
                if f.is_file():
                    sha = self.get_sha256(f)
                    entries.append(f"{f.name} (SHA256: {sha[:8]}...)")
                else:
                    entries.append(f"{f.name}/")
            return f"[FIELD: FILESYSTEM_ACTION] - Files in {self.project_root}:
" + "
".join(entries)
        except Exception as e:
            return f"[FIELD: FILESYSTEM_ACTION] - Error listing files: {e}"

    def read_target(self, file_name):
        """[FIELD: CONTEXT_RETRIEVAL] - Read file content and integrity hash."""
        try:
            file_path = self._get_relative_path(file_name)
            if file_path.exists() and file_path.is_file():
                sha = self.get_sha256(file_path)
                content = file_path.read_text(errors='ignore')
                return (f"[FIELD: CONTEXT_RETRIEVAL] - File: {file_name}
"
                        f"[FIELD: INTEGRITY] - SHA256: {sha}

---
{content}
---
")
            return f"[FIELD: CONTEXT_RETRIEVAL] - File not found: '{file_name}'"
        except Exception as e:
            return f"[FIELD: CONTEXT_RETRIEVAL] - Error: {e}"

    def apply_patch(self, file_name, new_content):
        """[FIELD: WRITE_ACTION] - Surgical Fix with Snapshot and Integrity Verify."""
        try:
            file_path = self._get_relative_path(file_name)
            
            # 1. Read-Before-Write & Snapshot
            if file_path.exists():
                old_sha = self.get_sha256(file_path)
                snapshot_file = self.create_snapshot(file_path)
            else:
                return f"[FIELD: WRITE_ACTION] - Error: Target '{file_name}' must exist."

            # 2. Perform Write
            file_path.write_text(new_content, encoding='utf-8', errors='ignore')
            
            # 3. Verify Integrity
            new_sha = self.get_sha256(file_path)
            return (f"[FIELD: WRITE_ACTION] - Patch applied to '{file_name}'.
"
                    f"[FIELD: SNAPSHOT] - Backup created at {snapshot_file}
"
                    f"[FIELD: INTEGRITY_VERIFY] - New SHA256: {new_sha}")
        except Exception as e:
            return f"[FIELD: WRITE_ACTION] - Error: {e}"

class EthubSurgicalEngine:
    """
    ETHUB-CLI: Semantic Formatting Engine.
    Implements High-Density Response Structure.
    """
    def format_debug_response(self, reason, fix_cmds, snippet=None, diff_patch=None):
        """[FIELD: SURGICAL_FORMATTING] - REASON, FIX_CMDS, SNIPPET, DIFF_PATCH."""
        response = [
            f"### [FIELD: REASON]
{reason}
",
            f"### [FIELD: FIX_CMDS]
```bash
{fix_cmds}
```
"
        ]
        if snippet:
            response.append(f"### [FIELD: SNIPPET]
{snippet}
")
        if diff_patch:
            # Wrap in unified diff syntax
            response.append(f"### [FIELD: DIFF_PATCH]
```diff
{diff_patch}
```
")
        return "
".join(response)

    def format_inquiry_response(self, facts, code_block):
        """[FIELD: INQUIRY_FORMATTING] - KEY POINTS, SOLUTION."""
        return (
            f"### [FIELD: KEY POINTS]
{facts}

"
            f"### [FIELD: SOLUTION]
{code_block}
"
        )
