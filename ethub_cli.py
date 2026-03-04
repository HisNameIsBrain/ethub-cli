#!/usr/bin/env python3
import os
import sys
import json
import argparse
from datetime import datetime

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
TRAINING_DIR = os.path.join(BASE_DIR, "training")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
COMMANDS_DOCS_DIR = os.path.join(DOCS_DIR, "commands")

# Data files
TRAINING_JSON = os.path.join(DATA_DIR, "training.json")
MEMORY_JSON = os.path.join(DATA_DIR, "memory.json")
SNIPPETS_JSON = os.path.join(DATA_DIR, "snippets.json")
HISTORY_JSON = os.path.join(DATA_DIR, "history.json")

# --- Utility Functions ---

def ensure_dirs():
    """Create necessary directories if they don't exist."""
    dirs = [DATA_DIR, TRAINING_DIR, DOCS_DIR, COMMANDS_DOCS_DIR]
    for d in dirs:
        if not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
            print(f"Created directory: {d}")

def load_json(file_path, default_type=dict):
    """Load data from a JSON file. Return empty dict or list if it doesn't exist."""
    if not os.path.exists(file_path):
        return default_type()
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default_type()

def save_json(file_path, data):
    """Save data to a JSON file with pretty printing."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w") as f:
        json.dump(data, f, indent=4)

def save_snapshot():
    """Save the current state of all data files to history.json before any change."""
    history = load_json(HISTORY_JSON, list)
    command_str = " ".join(sys.argv[1:])
    snapshot = {
        "command": command_str,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "data": {
            "training": load_json(TRAINING_JSON, list),
            "memory": load_json(MEMORY_JSON, dict),
            "snippets": load_json(SNIPPETS_JSON, dict)
        }
    }
    history.append(snapshot)
    # Limit history to 50 entries for more granular rollback
    if len(history) > 50:
        history.pop(0)
    save_json(HISTORY_JSON, history)

# --- Command Handlers ---

def cmd_init(args):
    """Initialize the project structure."""
    ensure_dirs()
    
    # Initialize JSON files
    if not os.path.exists(TRAINING_JSON):
        save_json(TRAINING_JSON, [])
        print(f"Initialized: {TRAINING_JSON}")
    if not os.path.exists(MEMORY_JSON):
        save_json(MEMORY_JSON, {})
        print(f"Initialized: {MEMORY_JSON}")
    if not os.path.exists(SNIPPETS_JSON):
        save_json(SNIPPETS_JSON, {})
        print(f"Initialized: {SNIPPETS_JSON}")
    if not os.path.exists(HISTORY_JSON):
        save_json(HISTORY_JSON, [])
        print(f"Initialized: {HISTORY_JSON}")
    
    print("ETHUB CLI project initialized successfully.")

def cmd_train(args):
    if args.subcommand == "add":
        save_snapshot()
        data = load_json(TRAINING_JSON, list)
        data.append(args.text)
        save_json(TRAINING_JSON, data)
        print(f"Added training entry: {args.text}")
    elif args.subcommand == "list":
        data = load_json(TRAINING_JSON, list)
        if not data:
            print("No training data found.")
        else:
            for i, entry in enumerate(data, 1):
                print(f"{i}. {entry}")
    elif args.subcommand == "clear":
        save_snapshot()
        save_json(TRAINING_JSON, [])
        print("Training data cleared.")
    else:
        print("Use 'ethub-cli train --help' for available subcommands.")

def cmd_memory(args):
    if args.subcommand == "save":
        save_snapshot()
        data = load_json(MEMORY_JSON, dict)
        data[args.key] = args.value
        save_json(MEMORY_JSON, data)
        print(f"Saved to memory: {args.key} -> {args.value}")
    elif args.subcommand == "get":
        data = load_json(MEMORY_JSON, dict)
        value = data.get(args.key)
        if value:
            print(f"{args.key}: {value}")
        else:
            print(f"Key '{args.key}' not found in memory.")
    elif args.subcommand == "list":
        data = load_json(MEMORY_JSON, dict)
        if not data:
            print("Memory is empty.")
        else:
            for key, value in data.items():
                print(f"{key}: {value}")
    elif args.subcommand == "clear":
        save_snapshot()
        save_json(MEMORY_JSON, {})
        print("Memory cleared.")
    else:
        print("Use 'ethub-cli memory --help' for available subcommands.")

def cmd_snippets(args):
    if args.subcommand == "add":
        save_snapshot()
        data = load_json(SNIPPETS_JSON, dict)
        data[args.name] = args.code
        save_json(SNIPPETS_JSON, data)
        print(f"Added snippet: {args.name}")
    elif args.subcommand == "get":
        data = load_json(SNIPPETS_JSON, dict)
        code = data.get(args.name)
        if code:
            print(f"--- Snippet: {args.name} ---\n{code}\n-------------------")
        else:
            print(f"Snippet '{args.name}' not found.")
    elif args.subcommand == "list":
        data = load_json(SNIPPETS_JSON, dict)
        if not data:
            print("No snippets found.")
        else:
            print("Available snippets:")
            for name in data.keys():
                print(f"- {name}")
    elif args.subcommand == "clear":
        save_snapshot()
        save_json(SNIPPETS_JSON, {})
        print("Snippets cleared.")
    else:
        print("Use 'ethub-cli snippets --help' for available subcommands.")

def cmd_rollback(args):
    """Roll back to the previous state of the data files."""
    history = load_json(HISTORY_JSON, list)
    if not history:
        print("No history found for rollback.")
        return
    
    # Get the last snapshot
    snapshot = history.pop()
    data = snapshot.get("data", {})
    command = snapshot.get("command", "Unknown command")
    timestamp = snapshot.get("timestamp", "Unknown time")
    
    # Revert all data files
    save_json(TRAINING_JSON, data.get("training", []))
    save_json(MEMORY_JSON, data.get("memory", {}))
    save_json(SNIPPETS_JSON, data.get("snippets", {}))
    
    # Update history file
    save_json(HISTORY_JSON, history)
    
    print(f"Rollback successful. Reverted changes made by: '{command}' at {timestamp}.")

# --- Main CLI Parser ---

def main():
    parser = argparse.ArgumentParser(description="ETHUB CLI - A versatile tool for training, memory, and snippets.")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # init command
    subparsers.add_parser("init", help="Initialize the project structure and data files.")

    # train command
    train_parser = subparsers.add_parser("train", help="Manage training data.")
    train_subparsers = train_parser.add_subparsers(dest="subcommand", help="Training subcommands")
    
    train_add = train_subparsers.add_parser("add", help="Add a new training entry.")
    train_add.add_argument("text", help="The training text to add.")
    
    train_subparsers.add_parser("list", help="List all training entries.")
    train_subparsers.add_parser("clear", help="Clear all training data.")

    # memory command
    memory_parser = subparsers.add_parser("memory", help="Manage persistent memory.")
    memory_subparsers = memory_parser.add_subparsers(dest="subcommand", help="Memory subcommands")
    
    memory_save = memory_subparsers.add_parser("save", help="Save a key-value pair to memory.")
    memory_save.add_argument("key", help="The memory key.")
    memory_save.add_argument("value", help="The memory value.")
    
    memory_get = memory_subparsers.add_parser("get", help="Retrieve a value from memory.")
    memory_get.add_argument("key", help="The memory key to retrieve.")
    
    memory_subparsers.add_parser("list", help="List all memory entries.")
    memory_subparsers.add_parser("clear", help="Clear all memory.")

    # snippets command
    snippets_parser = subparsers.add_parser("snippets", help="Manage code snippets.")
    snippets_subparsers = snippets_parser.add_subparsers(dest="subcommand", help="Snippets subcommands")
    
    snippets_add = snippets_subparsers.add_parser("add", help="Add a new snippet.")
    snippets_add.add_argument("name", help="The snippet name.")
    snippets_add.add_argument("code", help="The code snippet.")
    
    snippets_get = snippets_subparsers.add_parser("get", help="Retrieve a snippet by name.")
    snippets_get.add_argument("name", help="The snippet name to retrieve.")
    
    snippets_subparsers.add_parser("list", help="List all snippet names.")
    snippets_subparsers.add_parser("clear", help="Clear all snippets.")

    # rollback command
    subparsers.add_parser("rollback", help="Revert the last modification to training, memory, or snippets.")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "train":
        cmd_train(args)
    elif args.command == "memory":
        cmd_memory(args)
    elif args.command == "snippets":
        cmd_snippets(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
