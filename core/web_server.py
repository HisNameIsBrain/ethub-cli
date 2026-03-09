import http.server
import socketserver
import json
import os
import threading

# Global server instance for control
_httpd = None

class WebHandler(http.server.SimpleHTTPRequestHandler):
    """
    Secure Web Handler for ETHUB CLI Dashboard.
    - No CORS headers allowed (strict local-only).
    - Bound to 127.0.0.1 to prevent external network exposure.
    - Payload limits on POST to prevent DDoS/OOM.
    """
    def __init__(self, *args, **kwargs):
        self.web_dir = os.path.join(os.getcwd(), "ui", "web")
        super().__init__(*args, directory=self.web_dir, **kwargs)

    def log_message(self, format, *args):
        """Redirect server logs to agent-data/server-logs.json."""
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
        logs = logs[-100:] # Limit history
        
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        with open(log_file, "w") as f:
            json.dump(logs, f, indent=4)

    def do_GET(self):
        # Prevent path traversal
        if ".." in self.path:
            self.send_error(400, "Bad Request")
            return

        if self.path.startswith("/api/"):
            self.handle_api()
        else:
            # Serve static files from ui/web
            super().do_GET()

    def handle_api(self):
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
            "sysinfo": "sysinfo"
        }

        if endpoint in file_map:
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            # CRITICAL: No Access-Control-Allow-Origin headers here.
            self.end_headers()

            if endpoint == "sysinfo":
                from core.helper_engine import HelperEngine
                response = HelperEngine.get_system_info()
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

    def do_POST(self):
        # Security: Only allow POST to settings, with strict size limits
        if self.path == "/api/settings":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                # DDoS Prevention: Limit to 128KB for settings JSON
                if content_length > 128 * 1024:
                    self.send_error(413, "Payload Too Large")
                    return
                
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                from core.config_engine import ConfigEngine
                config = ConfigEngine()
                for key, val in data.items():
                    # Only allow specific config keys to be set via web
                    if key in ["model", "timeout", "max_steps", "ollama_url"]:
                        config.set(key, val)
                
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode("utf-8"))
            except Exception as e:
                self.send_error(400, f"Error: {e}")
        else:
            self.send_error(404)

def start_server(port=8080):
    global _httpd
    handler = WebHandler
    socketserver.TCPServer.allow_reuse_address = True
    try:
        # Binding to 127.0.0.1 is mandatory for security
        with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
            _httpd = httpd
            httpd.serve_forever()
    except Exception as e:
        # Silently fail or log to a file, don't spam CLI
        pass

def stop_web_ui():
    global _httpd
    if _httpd:
        _httpd.shutdown()
        _httpd.server_close()
        _httpd = None
        return True
    return False

def run_web_ui(port=8080):
    global _httpd
    if _httpd:
        return None
    thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    thread.start()
    return thread
