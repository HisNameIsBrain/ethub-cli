import os
import shutil
import json
from datetime import datetime

class SnapshotEngine:
    def __init__(self, data_dir="agent-data", snapshots_dir="agent-data/snapshots"):
        self.data_dir = data_dir
        self.snapshots_dir = snapshots_dir
        self.files_to_snapshot = [
            "history.json",
            "training.json",
            "memory.json",
            "snippets.json",
            "dependabot-risks.json"
        ]
        if not os.path.exists(self.snapshots_dir):
            os.makedirs(self.snapshots_dir, exist_ok=True)

    def create_snapshot(self, query):
        """Creates a timestamped snapshot of all state files."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        snapshot_path = os.path.join(self.snapshots_dir, timestamp)
        os.makedirs(snapshot_path, exist_ok=True)
        
        for filename in self.files_to_snapshot:
            src = os.path.join(self.data_dir, filename)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(snapshot_path, filename))
        
        # Log snapshot info in rollback.json
        rollback_file = os.path.join(self.data_dir, "rollback.json")
        rollback_data = self._load_json(rollback_file, list)
        rollback_data.append({
            "timestamp": datetime.now().isoformat(),
            "query": query,
            "snapshot_id": timestamp,
            "path": snapshot_path
        })
        if len(rollback_data) > 50: rollback_data.pop(0)
        self._save_json(rollback_file, rollback_data)
        
        return timestamp

    def rollback(self, steps=1):
        """Rollback to a previous state."""
        rollback_file = os.path.join(self.data_dir, "rollback.json")
        rollback_data = self._load_json(rollback_file, list)
        
        if len(rollback_data) < steps:
            return False, "Not enough history to rollback."
        
        target = rollback_data[-steps]
        snapshot_path = target["path"]
        
        for filename in self.files_to_snapshot:
            src = os.path.join(snapshot_path, filename)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(self.data_dir, filename))
        
        return True, f"Rolled back to: {target['query']} ({target['timestamp']})"

    def _load_json(self, path, default_type=dict):
        if not os.path.exists(path): return default_type()
        try:
            with open(path, "r") as f: return json.load(f)
        except: return default_type()

    def _save_json(self, path, data):
        with open(path, "w") as f: json.dump(data, f, indent=4)
