import os
import json
import urllib.request
import shutil
from datetime import datetime
from pathlib import Path
from core.config_engine import ConfigEngine
from core.helper_engine import HelperEngine

class SyncEngine:
    def __init__(self, project_root=None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.config = ConfigEngine()
        self.history_dir = self.project_root / ".ethub" / "history"
        self.sync_dir = self.project_root / "agent-data" / "sync"

    def sync_to_mothership(self):
        """Sends local snapshots and logs to the mothership if sync is enabled."""
        if not self.config.get("sync_enabled") or self.config.get("is_mothership"):
            return

        mothership_ip = self.config.get("private_ip") or self.config.get("mothership_ip")
        if not mothership_ip:
            return

        # 1. Sync latest history points
        self._sync_history(mothership_ip)
        
        # 2. Sync logs
        self._sync_logs(mothership_ip)

    def _sync_history(self, mothership_ip):
        """Syncs history snapshots as training data."""
        url = f"http://{mothership_ip}:8080/api/sync/snapshots"
        
        # Get all history folders
        if not self.history_dir.exists():
            return

        for point_dir in self.history_dir.iterdir():
            if point_dir.is_dir() and (point_dir / "manifest.json").exists():
                # We'll send the manifest and the JSON files in it
                with open(point_dir / "manifest.json", "r") as f:
                    manifest = json.load(f)
                
                # Bundle the snapshot data
                payload = {
                    "id": manifest["id"],
                    "label": manifest["label"],
                    "timestamp": manifest["timestamp"],
                    "state": {}
                }
                
                for f_name in ["history.json", "training.json", "memory.json"]:
                    src = point_dir / f_name
                    if src.exists():
                        try:
                            with open(src, "r") as f:
                                payload["state"][f_name] = json.load(f)
                        except: pass
                
                # Send to mothership
                try:
                    req = urllib.request.Request(
                        url, 
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json'}
                    )
                    with urllib.request.urlopen(req, timeout=10) as response:
                        res = json.loads(response.read().decode('utf-8'))
                        if res.get("status") == "success":
                            HelperEngine.print_success(f"Synced snapshot {manifest['id']} to mothership.")
                except Exception as e:
                    HelperEngine.print_error(f"Sync failed for {manifest['id']}: {e}")

    def _sync_logs(self, mothership_ip):
        """Syncs live logs to mothership."""
        url = f"http://{mothership_ip}:8080/api/sync/logs"
        log_file = self.project_root / "agent-data" / "live_logs.json"
        
        if not log_file.exists():
            return

        try:
            with open(log_file, "r") as f:
                logs = json.load(f)
            
            req = urllib.request.Request(
                url, 
                data=json.dumps(logs).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                pass
        except: pass
