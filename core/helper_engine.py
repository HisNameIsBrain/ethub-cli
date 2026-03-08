import datetime
import os
import platform
import shutil

class HelperEngine:
    @staticmethod
    def get_timestamp():
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def format_color(text, color_code):
        return f"\x1b[{color_code}m{text}\x1b[0m"

    @staticmethod
    def print_info(message):
        print(f"{HelperEngine.format_color('[INFO]', '36')} {message}")

    @staticmethod
    def print_success(message):
        print(f"{HelperEngine.format_color('[SUCCESS]', '32')} {message}")

    @staticmethod
    def print_warning(message):
        print(f"{HelperEngine.format_color('[WARNING]', '33')} {message}")

    @staticmethod
    def print_error(message):
        print(f"{HelperEngine.format_color('[ERROR]', '31')} {message}")

    @staticmethod
    def get_system_info():
        return {
            "os": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "cwd": os.getcwd(),
            "terminal_size": shutil.get_terminal_size()
        }

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
