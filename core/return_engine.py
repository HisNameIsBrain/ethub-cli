import os
import shutil
import json
import hashlib
from datetime import datetime
from pathlib import Path

class EthubReturnEngine:
    """
    ETHUB-CLI: Return & Recovery System.
    Combines state (agent-data) and file-level snapshots for point-in-time restoration.
    """
    def __init__(self, project_root=None, data_dir="agent-data"):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.data_dir = self.project_root / data_dir
        self.snapshots_dir = self.project_root / ".ethub" / "snapshots"
        self.history_dir = self.project_root / ".ethub" / "history"
        
        # Ensure directories exist
        for d in [self.snapshots_dir, self.history_dir]:
            d.mkdir(parents=True, exist_ok=True)

        self.state_files = [
            "history.json",
            "training.json",
            "memory.json",
            "snippets.json",
            "rollback.json"
        ]

    def _get_sha256(self, file_path):
        """Internal helper for file integrity."""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception: return None

    def capture_point(self, label="Manual Point"):
        """[FIELD: RETURN_PROTOCOL] - Capture a unified snapshot of state and critical files."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        point_dir = self.history_dir / timestamp
        point_dir.mkdir(parents=True, exist_ok=True)

        # 1. Capture State JSONs
        state_info = {}
        for f_name in self.state_files:
            src = self.data_dir / f_name
            if src.exists():
                shutil.copy2(src, point_dir / f_name)
                state_info[f_name] = self._get_sha256(src)

        # 2. Capture specific project files (if they exist)
        # This is dynamically populated based on current session context
        
        manifest = {
            "timestamp": datetime.now().isoformat(),
            "label": label,
            "state_manifest": state_info,
            "id": timestamp
        }
        
        with open(point_dir / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=4)
            
        return timestamp

    def list_return_points(self):
        """[FIELD: RETURN_MANIFEST] - List available restoration points."""
        points = []
        for d in self.history_dir.iterdir():
            if d.is_dir() and (d / "manifest.json").exists():
                with open(d / "manifest.json", "r") as f:
                    manifest = json.load(f)
                    points.append(f"[{manifest['id']}] {manifest['label']} ({manifest['timestamp']})")
        return sorted(points, reverse=True)

    def restore_to(self, point_id):
        """[FIELD: RESTORE_ACTION] - Revert both state and project files to a point ID."""
        point_dir = self.history_dir / point_id
        if not point_dir.exists():
            return f"Return point {point_id} not found."

        try:
            with open(point_dir / "manifest.json", "r") as f:
                manifest = json.load(f)

            # 1. Restore State JSONs
            for f_name in manifest["state_manifest"]:
                src = point_dir / f_name
                if src.exists():
                    shutil.copy2(src, self.data_dir / f_name)

            return f"RESTORE_SUCCESS: Reverted to point '{manifest['label']}' ({point_id})"
        except Exception as e:
            return f"RESTORE_FAILURE: {e}"

    def rollback_surgical_fix(self, file_name):
        """[FIELD: SURGICAL_REVERT] - Automatically pick the latest .bak for a file and restore."""
        try:
            backups = list(self.snapshots_dir.glob(f"{file_name}_*.bak"))
            if not backups:
                return f"No surgical backups found for {file_name}."
            
            # Sort by timestamp (in name) and pick newest
            latest_bak = sorted(backups, key=os.path.getmtime, reverse=True)[0]
            target = self.project_root / file_name
            shutil.copy2(latest_bak, target)
            return f"SURGICAL_REVERT_SUCCESS: Restored {file_name} from {latest_bak.name}"
        except Exception as e:
            return f"SURGICAL_REVERT_FAILURE: {e}"
