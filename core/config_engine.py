import json
import os

class ConfigEngine:
    DEFAULT_CONFIG = {
        "model": "qwen2.5:0.5b",
        "ollama_url": "http://127.0.0.1:11434/api/chat",
        "search_enabled": True,
        "max_steps": 10,
        "timeout": 120,
        "theme": "rainbow",
        "search_engines": ["google", "github", "wiki", "stackoverflow"]
    }

    def __init__(self, config_file="agent-data/config.json"):
        self.config_file = config_file
        self.config = self.DEFAULT_CONFIG.copy()
        self.load()

    def load(self):
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, "r") as f:
                    user_config = json.load(f)
                    self.config.update(user_config)
            except Exception as e:
                print(f"Error loading config: {e}")

    def save(self):
        os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
        try:
            with open(self.config_file, "w") as f:
                json.dump(self.config, f, indent=4)
        except Exception as e:
            print(f"Error saving config: {e}")

    def get(self, key, default=None):
        return self.config.get(key, default)

    def set(self, key, value):
        self.config[key] = value
        self.save()

    def list_settings(self):
        return self.config
