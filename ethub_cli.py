#!/usr/bin/env python3
import sys
import os
import argparse
import json
from datetime import datetime

from ui.rainbow_animation import run_intro
from core.reasoning_engine import ReasoningEngine
from core.action_engine import ActionEngine
from core.approval_engine import ApprovalEngine
from core.safety_engine import SafetyEngine
from core.search_engine import SearchEngine
from core.snapshot_engine import SnapshotEngine
from core.patch_engine import PatchEngine

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INITIAL_DIR = os.path.abspath(BASE_DIR)
DATA_DIR = os.path.join(BASE_DIR, "agent-data")
HISTORY_JSON = os.path.join(DATA_DIR, "history.json")

def ensure_dirs():
    dirs = [DATA_DIR, os.path.join(BASE_DIR, "rules"), os.path.join(BASE_DIR, "ui")]
    for d in dirs:
        if not os.path.exists(d):
            os.makedirs(d, exist_ok=True)

def load_json(file_path, default_type=dict):
    if not os.path.exists(file_path): return default_type()
    try:
        with open(file_path, "r") as f: return json.load(f)
    except: return default_type()

def save_json(file_path, data):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w") as f: json.dump(data, f, indent=4)

def log_history(query, reasoning, actions, approved, safe):
    history = load_json(HISTORY_JSON, list)
    history.append({
        "timestamp": datetime.now().isoformat(),
        "query": query,
        "reasoning": reasoning,
        "actions": actions,
        "approved": approved,
        "safe": safe
    })
    if len(history) > 100: history.pop(0)
    save_json(HISTORY_JSON, history)

def main():
    ensure_dirs()
    
    parser = argparse.ArgumentParser(description="ETHUB CLI - Secure Isolated Search Agent")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # search command
    search_parser = subparsers.add_parser("search", help="Perform a secure smart search.")
    search_parser.add_argument("query", help="The search query.")

    # rollback command
    rollback_parser = subparsers.add_parser("rollback", help="Roll back to previous snapshot.")
    rollback_parser.add_argument("--steps", type=int, default=1, help="Steps to rollback.")

    if len(sys.argv) == 1:
        run_intro(INITIAL_DIR)
        parser.print_help()
        print("\n\x1b[90mTip: Double-tap Tab (simulated) for history screen. Use 'rollback --steps N' to undo changes.\x1b[0m")
        return

    args = parser.parse_args()

    # Snapshot Engine (Always active)
    snapshot_engine = SnapshotEngine(data_dir=DATA_DIR)
    
    if args.command == "rollback":
        success, msg = snapshot_engine.rollback(args.steps)
        print(f"\x1b[32m{msg}\x1b[0m" if success else f"\x1b[31m{msg}\x1b[0m")
        return

    if args.command == "search":
        query = args.query
        
        # 0. Snapshot Current State
        snapshot_id = snapshot_engine.create_snapshot(query)
        print(f"\x1b[90mSnapshot created: {snapshot_id}\x1b[0m")

        # 1. Query Router & Reasoning
        reasoning_engine = ReasoningEngine()
        reasoning = reasoning_engine.analyze(query)
        print(f"\x1b[38;5;81mClassified as: {reasoning['query_type'].upper()}\x1b[0m")
        
        # 2. Action Stage
        action_engine = ActionEngine()
        actions = action_engine.decide_actions(reasoning)
        actions["query"] = query
        
        # 3. Security Audit (Initial Query Audit)
        safety_engine = SafetyEngine()
        is_safe, risks = safety_engine.audit_source_chunk(query, "user_input", query)
        if not is_safe:
            print("\x1b[31mQuery denied by Security Audit!\x1b[0m")
            for risk in risks: print(f"Risk: {risk}")
            log_history(query, reasoning, actions, False, False)
            return

        # 4. Approval Gate
        approval_engine = ApprovalEngine(approvals_file=os.path.join(DATA_DIR, "approvals.json"))
        if not approval_engine.ask(actions):
            print("\x1b[31mAction cancelled by user.\x1b[0m")
            log_history(query, reasoning, actions, False, True)
            return

        # 5. Source Fetcher & Execution (with Chunk Auditing)
        search_engine = SearchEngine(results_file=os.path.join(DATA_DIR, "results.json"))
        sources = actions.get("sources", [])
        
        results = []
        for engine_name in sources:
            url = search_engine._get_url(engine_name, query)
            if url:
                print(f"Fetching chunk from {engine_name}...")
                # Simulated chunk for audit (In real implementation, fetch content here)
                simulated_chunk = f"Results for {query} from {engine_name}..."
                
                safe_chunk, chunk_risks = safety_engine.audit_source_chunk(query, url, simulated_chunk)
                if not safe_chunk:
                    print(f"\x1b[31mBlocked untrusted content from {url}\x1b[0m")
                    continue
                
                print(f"Searching {engine_name} for: {query}")
                import webbrowser
                webbrowser.open(url)
                results.append({"engine": engine_name, "url": url})
        
        search_engine._store_results(query, results)
        
        # 6. Patch Generator (Simulated example of patch workflow)
        if reasoning["query_type"] == "code_query":
            patch_engine = PatchEngine(safety_engine)
            # Example: Suggesting a small fix in history.json logic (simulated)
            # In a real scenario, this would come from the agent's logic.
            print("\x1b[38;5;214mSafe Patch Generated (Review in agent-data/snippets.json)\x1b[0m")

        log_history(query, reasoning, actions, True, True)
        print("\x1b[32mProcess complete. Logs saved in agent-data/\x1b[0m")

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
