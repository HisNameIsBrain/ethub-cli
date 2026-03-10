import datetime
import os
import platform
import shutil
import json

class HelperEngine:
    LOG_FILE = "agent-data/live_logs.json"

    @staticmethod
    def get_timestamp():
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def log_live(category, message, details=None):
        """Logs a detailed event for the web dashboard."""
        log_entry = {
            "timestamp": HelperEngine.get_timestamp(),
            "category": category,
            "message": message,
            "details": details or {}
        }
        
        logs = []
        if os.path.exists(HelperEngine.LOG_FILE):
            try:
                with open(HelperEngine.LOG_FILE, "r") as f:
                    logs = json.load(f)
            except:
                logs = []
        
        logs.append(log_entry)
        # Keep only the last 100 logs to prevent file bloat
        logs = logs[-100:]
        
        os.makedirs(os.path.dirname(HelperEngine.LOG_FILE), exist_ok=True)
        with open(HelperEngine.LOG_FILE, "w") as f:
            json.dump(logs, f, indent=4)

    @staticmethod
    def log_console(text):
        """Logs raw console output for the web dashboard."""
        console_file = "agent-data/cli-console.json"
        entry = {
            "timestamp": HelperEngine.get_timestamp(),
            "text": text
        }
        
        console_logs = []
        if os.path.exists(console_file):
            try:
                with open(console_file, "r") as f:
                    console_logs = json.load(f)
            except:
                console_logs = []
        
        console_logs.append(entry)
        # Keep last 50 lines
        console_logs = console_logs[-50:]
        
        os.makedirs(os.path.dirname(console_file), exist_ok=True)
        with open(console_file, "w") as f:
            json.dump(console_logs, f, indent=4)

    @staticmethod
    def format_color(text, color_code):
        return f"\x1b[{color_code}m{text}\x1b[0m"

    @staticmethod
    def print_info(message, details=None):
        text = f"{HelperEngine.format_color('[INFO]', '36')} {message}"
        print(text)
        HelperEngine.log_console(text)
        HelperEngine.log_live("info", message, details)

    @staticmethod
    def print_success(message, details=None):
        text = f"{HelperEngine.format_color('[SUCCESS]', '32')} {message}"
        print(text)
        HelperEngine.log_console(text)
        HelperEngine.log_live("success", message, details)

    @staticmethod
    def print_warning(message, details=None):
        text = f"{HelperEngine.format_color('[WARNING]', '33')} {message}"
        print(text)
        HelperEngine.log_console(text)
        HelperEngine.log_live("warning", message, details)

    @staticmethod
    def print_error(message, details=None):
        text = f"{HelperEngine.format_color('[ERROR]', '31')} {message}"
        print(text)
        HelperEngine.log_console(text)
        HelperEngine.log_live("error", message, details)

    @staticmethod
    def get_system_info():
        info = {
            "os": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
            "cwd": os.getcwd(),
            "terminal_size": list(shutil.get_terminal_size()),
            "timestamp": HelperEngine.get_timestamp(),
            "memory": HelperEngine._get_mem_info()
        }
        
        # Save to sysinfo.json
        sysinfo_file = "agent-data/sysinfo.json"
        os.makedirs(os.path.dirname(sysinfo_file), exist_ok=True)
        with open(sysinfo_file, "w") as f:
            json.dump(info, f, indent=4)
            
        return info

    @staticmethod
    def _get_mem_info():
        try:
            import psutil
            mem = psutil.virtual_memory()
            return {
                "total": mem.total,
                "available": mem.available,
                "percent": mem.percent
            }
        except ImportError:
            return "psutil not installed"

    @staticmethod
    def clear_screen():
        os.system('cls' if os.name == 'nt' else 'clear')

    @staticmethod
    def format_box(text, title=None, width=None):
        if not width:
            width = shutil.get_terminal_size().columns - 4
        
        lines = text.split('\n')
        wrapped_lines = []
        for line in lines:
            while len(line) > width - 4:
                wrapped_lines.append(line[:width - 4])
                line = line[width - 4:]
            wrapped_lines.append(line)
        
        output = "┌" + "─" * (width - 2) + "┐\n"
        if title:
            output += "│ " + title.center(width - 4) + " │\n"
            output += "├" + "─" * (width - 2) + "┤\n"
        
        for line in wrapped_lines:
            output += "│ " + line.ljust(width - 4) + " │\n"
        
        output += "└" + "─" * (width - 2) + "┘"
        return output
