import http.server
import socketserver
import json
import os
import threading
import urllib.parse
import sys
from datetime import datetime

# Global server instance for control
_httpd = None

class WebHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Set the directory to ui/web where our frontend will live
        self.web_dir = os.path.join(os.getcwd(), "ui", "web")
        super().__init__(*args, directory=self.web_dir, **kwargs)

    def log_message(self, format, *args):
        """Redirect server logs to a file instead of terminal."""
        log_entry = {
            "timestamp": self.log_date_time_string(),
            "client": self.client_address[0],
            "message": format % args
        }
        log_file = os.path.join(os.getcwd(), "agent-data", "server-logs.json")
        
        logs = []
        if os.path.exists(log_file):
            try:
                with open(log_file, "r") as f:
                    logs = json.load(f)
            except:
                logs = []
        
        logs.append(log_entry)
        logs = logs[-50:] # Keep last 50 requests
        
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        with open(log_file, "w") as f:
            json.dump(logs, f, indent=4)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api()
        else:
            super().do_GET()

    def handle_api(self):
        try:
            endpoint = self.path.split("/")[-1]
            data_dir = os.path.join(os.getcwd(), "agent-data")
            file_map = {
                "history": "history.json",
                "settings": "config.json",
                "risks": "dependabot-risks.json",
                "memory": "memory.json",
                "results": "results.json",
                "logs": "live_logs.json",
                "cli-console": "cli-console.json",
                "server-logs": "server-logs.json",
                "sysinfo": "sysinfo.json",
                "return-points": "return-points",
                "snapshots": "snapshots",
                "system-prompt": "system-prompt",
                "tools-list": "tools-list",
                "kb": "kb",
                "cluster": "cluster"
            }

            if endpoint in file_map:
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                if endpoint == "sysinfo":
                    from core.helper_engine import HelperEngine
                    response = HelperEngine.get_system_info()
                elif endpoint == "kb":
                    # Simple Knowledge Base search logic
                    query = self.headers.get("X-Query", "")
                    response = self.search_knowledge_base(query)
                elif endpoint == "cluster":
                    from core.config_engine import ConfigEngine
                    config = ConfigEngine()
                    response = {
                        "mode": config.get("cluster_mode"),
                        "contribution": config.get("resource_contribution"),
                        "mothership_ip": config.get("mothership_ip")
                    }
                elif endpoint == "system-prompt":
                    from ethub_cli import SYSTEM_PROMPT
                    response = {"prompt": SYSTEM_PROMPT}
                elif endpoint == "tools-list":
                    response = {
                        "tools": [
                            {"name": "web_search", "desc": "Internet queries"},
                            {"name": "fetch_url", "desc": "Read webpage content"},
                            {"name": "ethub_action", "desc": "Surgical filesystem actions"},
                            {"name": "final_answer", "desc": "Resolution to user"}
                        ]
                    }
                elif endpoint == "return-points":
                    from core.return_engine import EthubReturnEngine
                    re_eng = EthubReturnEngine()
                    response = re_eng.list_return_points()
                elif endpoint == "snapshots":
                    from core.surgical_engine import EthubActionEngine
                    ae_eng = EthubActionEngine()
                    snapshot_dir = ae_eng.snapshot_dir
                    if snapshot_dir.exists():
                        response = [f.name for f in snapshot_dir.glob("*.bak")]
                    else:
                        response = []
                else:
                    file_path = os.path.join(data_dir, file_map[endpoint])
                    if os.path.exists(file_path):
                        with open(file_path, "r") as f:
                            try:
                                response = json.load(f)
                            except:
                                response = [] if endpoint not in ["settings"] else {}
                    else:
                        response = [] if endpoint not in ["settings"] else {}
                
                self.wfile.write(json.dumps(response).encode("utf-8"))
            else:
                self.send_error(404, "Endpoint not found")
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

    def search_knowledge_base(self, query):
        """Searches the agent-data directory for knowledge."""
        results = []
        data_dir = os.path.join(os.getcwd(), "agent-data")
        for root, dirs, files in os.walk(data_dir):
            for file in files:
                if file.endswith(".json") or file.endswith(".txt"):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            if query.lower() in content.lower():
                                results.append({"file": file, "preview": content[:200]})
                    except: pass
        return results

    def do_POST(self):
        if self.path.startswith("/api/sync/"):
            self.handle_sync()
        elif self.path == "/api/settings":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                from core.config_engine import ConfigEngine
                config = ConfigEngine()
                for key, val in data.items():
                    config.set(key, val)
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        elif self.path == "/api/action":
            # (Keep original action code)
            pass

    def handle_sync(self):
        endpoint = self.path.split("/")[-1]
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            client_ip = self.client_address[0].replace(".", "_")
            sync_dir = os.path.join(os.getcwd(), "agent-data", "sync", client_ip, endpoint)
            os.makedirs(sync_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"sync_{timestamp}.json"
            
            with open(os.path.join(sync_dir, file_name), "w") as f:
                json.dump(data, f, indent=4)
                
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "file": file_name}).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))


    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

def start_server(port=8080):
    global _httpd
    handler = WebHandler
    # Allow port reuse to avoid "Address already in use" errors on restart
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            _httpd = httpd
            # Suppressing console notification as per request
            # print(f"\n\x1b[32m[WEB] Server active at http://localhost:{port}\x1b[0m")
            httpd.serve_forever()
    except Exception as e:
        # We can still log errors to console for critical failures
        print(f"\x1b[31m[WEB] Server failed: {e}\x1b[0m")

def stop_web_ui():
    global _httpd
    if _httpd:
        print("\n\x1b[33m[WEB] Stopping server...\x1b[0m")
        _httpd.shutdown()
        _httpd.server_close()
        _httpd = None
        return True
    return False

def run_web_ui(port=8080):
    global _httpd
    if _httpd:
        return None # Already running
    thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    thread.start()
    return thread
