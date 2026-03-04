#!/usr/bin/env python3
import os
import sys
import json
import argparse
import subprocess
import webbrowser
import urllib.parse
import shutil
import shlex
import difflib
import re
from datetime import datetime

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INITIAL_DIR = os.path.abspath(BASE_DIR)
current_working_dir = INITIAL_DIR
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

def run_intro():
    """Run the ANSI intro animation."""
    intro_path = os.path.join(BASE_DIR, "ansi-intro.mjs")
    if os.path.exists(intro_path):
        try:
            # Use node to run the intro script
            subprocess.run(["node", intro_path], check=False)
        except Exception:
            # Silently fail if node is not installed or intro fails
            pass

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

def is_safe_path(path):
    """Check if a path is within the INITIAL_DIR for forward travel only."""
    global current_working_dir
    target_path = os.path.abspath(os.path.join(current_working_dir, path))
    return target_path.startswith(INITIAL_DIR)

def get_approval(cmd, reason):
    """Ask user for approval to run a command."""
    print(f"\n\x1b[38;5;214mProposed Command:\x1b[0m {cmd}")
    print(f"\x1b[38;5;81mReasoning:\x1b[0m {reason}")
    print("\x1b[38;5;245mOptions: [a]pprove, [d]eny, [e]dit prompt\x1b[0m")
    return input("Choice: ").strip().lower()

def extract_and_save_data(query, response_text):
    """Extract code snippets and save to training/memory/snippets."""
    snippets = re.findall(r"```(?:\w+)?\n(.*?)```", response_text, re.DOTALL)
    
    # Save to memory
    memory = load_json(MEMORY_JSON, dict)
    memory[f"last_query_{datetime.now().timestamp()}"] = query
    save_json(MEMORY_JSON, memory)
    
    if snippets:
        snip_data = load_json(SNIPPETS_JSON, dict)
        for i, code in enumerate(snippets):
            name = f"auto_{int(datetime.now().timestamp())}_{i}"
            snip_data[name] = code
            print(f"\x1b[32mAuto-saved snippet: {name}\x1b[0m")
            
            # Save to training
            training = load_json(TRAINING_JSON, list)
            training.append({
                "query": query,
                "source": "Smart Search (Auto-extracted)",
                "snippet": code,
                "description": f"Extracted from response to: {query}",
                "timestamp": datetime.now().isoformat()
            })
            save_json(TRAINING_JSON, training)
        save_json(SNIPPETS_JSON, snip_data)

def audit_and_diff(file_path, new_content):
    """Show diff before applying changes."""
    if not os.path.exists(file_path):
        print(f"Creating new file: {file_path}")
        return True
    
    with open(file_path, "r") as f:
        old_content = f.read()
    
    diff = difflib.unified_diff(
        old_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile='Current', tofile='New'
    )
    diff_text = "".join(diff)
    if not diff_text:
        print("No changes needed.")
        return False
    
    print(f"\n\x1b[33m--- Audit Diff for {file_path} ---\x1b[0m\n{diff_text}")
    return True

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

def cmd_search(args):
    """Helper to search on various platforms without requiring login."""
    query = args.query
    engine = args.engine.lower()
    
    encoded_query = urllib.parse.quote(query)
    engines = {
        "google": f"https://www.google.com/search?q={encoded_query}",
        "github": f"https://github.com/search?q={encoded_query}",
        "wiki": f"https://en.wikipedia.org/wiki/Special:Search?search={encoded_query}",
        "substack": f"https://substack.com/search/{encoded_query}",
        "chatgpt": f"https://chatgpt.com/?q={encoded_query}", 
    }
    
    if engine in engines:
        url = engines[engine]
        print(f"Searching {engine} for: {query}")
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"Failed to open browser: {e}")
            print(f"Link: {url}")
    else:
        print(f"Engine '{engine}' not supported. Available: {', '.join(engines.keys())}")

def is_error_report(text):
    """Detect if the input looks like a code error or stack trace."""
    error_indicators = ["traceback", "error:", "exception", "failed", "line ", "stack overflow", "undefined"]
    return any(indicator in text.lower() for indicator in error_indicators)

def handle_smart_request(query):
    """Route the request to the best sources based on content."""
    encoded_query = urllib.parse.quote(query)
    
    if is_error_report(query):
        print("\x1b[38;5;208m[Debug Mode]\x1b[0m Detected error/issue. Finding safe, ethical solutions...")
        # Prioritize Google (with stackoverflow) and GitHub for debugging
        webbrowser.open(f"https://www.google.com/search?q=site:stackoverflow.com+{encoded_query}")
        webbrowser.open(f"https://github.com/search?q={encoded_query}+type:issue")
    else:
        print(f"\x1b[38;5;81m[Smart Search]\x1b[0m Finding the best result for: {query}")
        # Default to Google and ChatGPT for high-hype/functional results
        webbrowser.open(f"https://www.google.com/search?q={encoded_query}")
        webbrowser.open(f"https://chatgpt.com/?q={encoded_query}")

def cmd_interactive(parser):
    """Run the interactive chat loop with shell commands and approval workflow."""
    global current_working_dir
    print("\n\x1b[1;34mETHUB-CLI Interactive Chat\x1b[0m")
    print("Commands: ls, cd, cp, mv, co (cat), rm, help, exit")
    print("Or type a request/paste an error for smart search.\n")
    
    while True:
        try:
            rel_path = os.path.relpath(current_working_dir, INITIAL_DIR)
            prompt_path = "~" if rel_path == "." else f"~/{rel_path}"
            user_input = input(f"\x1b[38;5;25methub-cli:{prompt_path}>\x1b[0m ").strip()
            
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit", "bye"]:
                print("Goodbye!")
                break
            
            parts = shlex.split(user_input)
            cmd = parts[0].lower()
            
            # Internal Commands (train, memory, etc.)
            if cmd in ["init", "train", "memory", "snippets", "rollback", "search", "help"]:
                if cmd == "help":
                    parser.print_help()
                    continue
                try:
                    args = parser.parse_args(parts)
                    if args.command == "init": cmd_init(args)
                    elif args.command == "search": cmd_search(args)
                    elif args.command == "train": cmd_train(args)
                    elif args.command == "memory": cmd_memory(args)
                    elif args.command == "snippets": cmd_snippets(args)
                    elif args.command == "rollback": cmd_rollback(args)
                except SystemExit:
                    pass
                continue

            # Shell Commands
            if cmd in ["ls", "cd", "cp", "mv", "co", "rm", "cat"]:
                if cmd == "cat": cmd = "co" # Alias cat to co as requested
                
                reason = ""
                full_cmd = ""
                
                if cmd == "ls":
                    reason = "Lists files in current or target directory."
                    full_cmd = f"ls {shlex.join(parts[1:])}"
                elif cmd == "cd":
                    target = parts[1] if len(parts) > 1 else "."
                    if not is_safe_path(target):
                        print("\x1b[31mError: Forward travel only! Cannot navigate above project root.\x1b[0m")
                        continue
                    reason = f"Changes directory to: {target}"
                    full_cmd = f"cd {target}"
                elif cmd in ["cp", "mv", "rm", "co"]:
                    reason = f"Perform file operation: {cmd}"
                    full_cmd = f"{cmd} {shlex.join(parts[1:])}"

                choice = get_approval(full_cmd, reason)
                if choice == 'a':
                    if cmd == "ls":
                        target = os.path.join(current_working_dir, parts[1]) if len(parts) > 1 else current_working_dir
                        print("\n".join(os.listdir(target)))
                    elif cmd == "cd":
                        target = os.path.join(current_working_dir, parts[1]) if len(parts) > 1 else INITIAL_DIR
                        if os.path.isdir(target):
                            current_working_dir = os.path.abspath(target)
                    elif cmd == "co":
                        target = os.path.join(current_working_dir, parts[1])
                        if os.path.isfile(target):
                            with open(target, 'r') as f:
                                print(f.read())
                    elif cmd == "cp":
                        src = os.path.join(current_working_dir, parts[1])
                        dst = os.path.join(current_working_dir, parts[2])
                        shutil.copy2(src, dst)
                    elif cmd == "mv":
                        src = os.path.join(current_working_dir, parts[1])
                        dst = os.path.join(current_working_dir, parts[2])
                        shutil.move(src, dst)
                    elif cmd == "rm":
                        target = os.path.join(current_working_dir, parts[1])
                        if os.path.isfile(target): os.remove(target)
                        elif os.path.isdir(target): shutil.rmtree(target)
                elif choice == 'e':
                    # Return text to chat and fix
                    print(f"Returning to prompt: {user_input}")
                    continue # Loop back
                else:
                    print("Action cancelled.")
                continue

            # Smart Request
            handle_smart_request(user_input)
            # Placeholder for extracting/saving data since we don't have real AI response here
            # But we could extract from the user input if it was a paste of code
            if "```" in user_input:
                extract_and_save_data(user_input, user_input)
            
        except (KeyboardInterrupt, EOFError):
            print("\nExiting...")
            break
        except Exception as e:
            print(f"\x1b[31mError: {e}\x1b[0m")

# --- Main CLI Parser ---

def main():
    run_intro()
    
    parser = argparse.ArgumentParser(description="ETHUB CLI - A versatile tool for training, memory, and snippets.")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # init command
    subparsers.add_parser("init", help="Initialize the project structure and data files.")

    # search command
    search_parser = subparsers.add_parser("search", help="Search the web without accounts.")
    search_parser.add_argument("engine", choices=["google", "github", "wiki", "substack", "chatgpt"], help="Search engine to use.")
    search_parser.add_argument("query", help="The search query.")

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

    # If no arguments provided, enter interactive mode
    if len(sys.argv) == 1:
        cmd_interactive(parser)
        return

    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "search":
        cmd_search(args)
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
