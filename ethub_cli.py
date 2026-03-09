#!/usr/bin/env python3
import json
import urllib.request
import urllib.parse
import urllib.error
import argparse
import sys
import re
import os
import time
import zipfile
import io
import readline
from html.parser import HTMLParser

# Import core engines
try:
    from core.config_engine import ConfigEngine
    from core.helper_engine import HelperEngine
    from core.safety_engine import SafetyEngine
    from core.hybrid_engine import HybridEngine
    from core.return_engine import EthubReturnEngine
    from core.research_engine import ResearchEngine
    from ui.rainbow_animation import run_intro
except ImportError as e:
    print(f"Error importing core components: {e}")
    sys.exit(1)

# Load configuration
config = ConfigEngine()
helper = HelperEngine()
safety_engine = SafetyEngine()
hybrid_engine = HybridEngine()
return_engine = EthubReturnEngine()
research_engine = ResearchEngine(model=config.get("model", "qwen2.5:0.5b"))

SYSTEM_PROMPT = """You are an autonomous AI agent with web search capabilities.
You run in a terminal and must help the user by finding information on the web.
You have access to the following tools:
1. "web_search": Searches the internet. Requires argument "query".
2. "fetch_url": Fetches text content from a specific URL.
3. "research_topic": Performs a deep, verified staircase research on a topic. Requires "topic".
4. "ethub_return": Performs system recovery actions (list/restore/rollback). Requires "sub" (list/restore/rollback). For "restore", requires "point_id". For "rollback", requires "target" (file name).
5. "final_answer": Provides the final response to the user. Requires argument "text".

### 🏗️ Strategic Formatting Hierarchy
When you process code, debugging information, or errors, you MUST use the following Semantic Labels:
1. [FIELD: REASON]: Defines the technical "why" behind an error.
2. [FIELD: FIX_CMDS]: Lists the exact shell instructions required for resolution.
3. [FIELD: DIFF_PATCH]: Surgical code comparison using unified diff syntax.
4. [FIELD: SNIPPET]: Direct code fragment relevant to the fix.
5. [FIELD: AUDIT]: Security audit trail of the proposed fix.
6. [FIELD: RETURN]: Feedback on restoration or rollback actions.

For simple technical questions, use:
- [FIELD: KEY POINTS]: Bulleted chunks for listing "Key Points" or technical facts.
- [FIELD: SOLUTION]: Syntax-highlighted code block for the solution.

You must ALWAYS respond with ONLY a valid JSON object in the following format:
{
  "thought": "your reasoning about what to do next",
  "action": "tool_name",
  "args": {"arg_name": "arg_value"}
}
Do not include any extra text outside the JSON object.
"""

class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs= True
        self.text = []
    def handle_data(self, d):
        self.text.append(d)
    def get_data(self):
        return ''.join(self.text)

def strip_tags(html):
    s = MLStripper()
    s.feed(html)
    return s.get_data()

def web_search(query):
    url = 'https://lite.duckduckgo.com/lite/'
    data = urllib.parse.urlencode({'q': query}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    timeout = config.get("timeout", 120)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            html = response.read().decode('utf-8')
            snippets = re.findall(r'<td class="result-snippet"[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
            links = re.findall(r'<a class="result-url" href="([^"]+)">', html, re.IGNORECASE)
            
            results = []
            for i in range(min(5, len(snippets), len(links))):
                text = strip_tags(snippets[i]).strip()
                results.append(f"Result {i+1}: {text}\nURL: {links[i]}")
            
            return "\n\n".join(results) if results else "No results found."
    except Exception as e:
        return f"Search failed: {e}"

def fetch_url(url, query="general_fetch"):
    timeout = config.get("timeout", 120)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            html = response.read().decode('utf-8')
            
            # Security Audit of raw HTML
            is_safe, risks = safety_engine.audit_source_chunk(query, url, html)
            if not is_safe:
                return f"Fetch denied by SafetyEngine. Risks: {'; '.join(risks)}"
                
            body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.IGNORECASE | re.DOTALL)
            if body_match:
                html = body_match.group(1)
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL)
            html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.IGNORECASE | re.DOTALL)
            text = strip_tags(html)
            text = re.sub(r'\s+', ' ', text)
            
            # Additional Audit on stripped text
            is_safe, risks = safety_engine.audit_source_chunk(query, url, text[:3000])
            if not is_safe:
                 return f"Fetch denied by SafetyEngine after extraction. Risks: {'; '.join(risks)}"
                 
            return text[:3000]
    except Exception as e:
        return f"Fetch failed: {e}"

def ethub_return_action(sub, point_id=None, target=None):
    """Executes a recovery action using the EthubReturnEngine."""
    if sub == "list":
        points = return_engine.list_return_points()
        return f"[FIELD: RETURN_MANIFEST]\n" + "\n".join(points)
    elif sub == "restore":
        if not point_id: return "Error: 'point_id' required for restore."
        return return_engine.restore_to(point_id)
    elif sub == "rollback":
        if not target: return "Error: 'target' file name required for surgical rollback."
        return return_engine.rollback_surgical_fix(target)
    else:
        return f"Unknown recovery sub-action: {sub}. Use list, restore, or rollback."

def chat_with_ollama(messages):
    ollama_url = config.get("ollama_url").replace("/api/pull", "/api/chat") # Auto-fix old typo if present
    model = config.get("model")
    timeout = config.get("timeout", 120)
    data = {
        "model": model,
        "messages": messages,
        "stream": False,
        "format": "json"
    }
    try:
        req = urllib.request.Request(ollama_url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res['message']['content']
    except urllib.error.URLError as e:
        return json.dumps({"action": "final_answer", "args": {"text": f"Error communicating with Ollama server at {ollama_url}. Is it running or did it time out? Details: {e}"}})
    except KeyboardInterrupt:
        # Re-raise KeyboardInterrupt so it can be handled by main
        raise
    except Exception as e:
        return json.dumps({"action": "final_answer", "args": {"text": f"Error communicating with Ollama: {e}"}})

def run_agent_loop(messages, query=""):
    helper.print_info("Agent is thinking...")
    steps = 0
    max_steps = config.get("max_steps", 10)
    
    # Snapshot before execution
    if query:
        return_id = return_engine.capture_point(label=f"Query: {query[:50]}")
        helper.print_info(f"Return point captured: {return_id}")
        
        # Log to history.json
        history_file = "agent-data/history.json"
        history = []
        if os.path.exists(history_file):
            try:
                with open(history_file, "r") as f: history = json.load(f)
            except: pass
        
        history.append({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "query": query,
            "return_id": return_id
        })
        with open(history_file, "w") as f: json.dump(history, f, indent=4)
        
        # Hybrid Reasoning Phase
        reasoning, actions = hybrid_engine.process_query(query, messages)
        helper.log_live("reasoning", f"Hybrid Reasoning for: {query}", {"reasoning": reasoning, "recommended_actions": actions})
        
        # Inject the reasoning into context to guide the agent loop
        intent_context = f"[Internal Reasoning] Intent: {reasoning.get('intent')}, Keywords: {reasoning.get('keywords')}. Recommended Search Sources: {actions.get('sources')}"
        messages.append({"role": "system", "content": intent_context})
        
    while steps < max_steps:
        response_text = chat_with_ollama(messages)
        messages.append({"role": "assistant", "content": response_text})
        
        try:
            response_json = json.loads(response_text)
            thought = response_json.get("thought", "")
            action = response_json.get("action", "")
            args = response_json.get("args", {})
            
            if thought:
                # Log thought to web with detail, keep CLI simple
                text = f"\x1b[90mThought: {thought[:100]}...\x1b[0m"
                print(text)
                helper.log_console(text)
                helper.log_live("thought", "Agent is thinking...", {"thought": thought})
                
            if action == "final_answer":
                text = args.get('text', '')
                
                # Check for surgical fix patterns and perform audit
                audit_info = ""
                if "[FIELD: FIX_CMDS]" in text or "[FIELD: DIFF_PATCH]" in text:
                    helper.print_info("Performing security audit on proposed fix...")
                    # Extract for audit (rough extraction)
                    fix_cmds = re.search(r'\[FIELD: FIX_CMDS\](.*?)(?=\[FIELD:|$)', text, re.DOTALL)
                    diff_patch = re.search(r'\[FIELD: DIFF_PATCH\](.*?)(?=\[FIELD:|$)', text, re.DOTALL)
                    
                    cmd_val = fix_cmds.group(1).strip() if fix_cmds else ""
                    patch_val = diff_patch.group(1).strip() if diff_patch else ""
                    
                    is_safe, audit_msg = safety_engine.perform_surgical_audit(cmd_val, patch_val)
                    if not is_safe:
                        text += f"\n\n### [FIELD: AUDIT]\nCRITICAL: {audit_msg}\nPROCEED WITH CAUTION."
                        helper.print_warning(f"Audit Warning: {audit_msg}")
                    else:
                        audit_info = f"\n\n### [FIELD: AUDIT]\n{audit_msg}"
                        text += audit_info
                
                helper.log_live("action", "Final Answer provided", {"text": text})
                print(f"\n\x1b[36mAgent:\x1b[0m {text}")
                helper.log_console(f"Agent: {text}")
                break
            elif action == "web_search":
                search_query = args.get('query', '')
                helper.log_live("action", f"Searching: {search_query}", {"query": search_query})
                text = f"\x1b[33m[*] Searching the web...\x1b[0m"
                print(text)
                helper.log_console(text)
                result = web_search(search_query)
                messages.append({"role": "user", "content": f"Search Results for '{search_query}':\n{result}"})
            elif action == "fetch_url":
                url = args.get('url', '')
                helper.log_live("action", f"Fetching: {url}", {"url": url})
                text = f"\x1b[33m[*] Fetching remote content...\x1b[0m"
                print(text)
                helper.log_console(text)
                result = fetch_url(url, query)
                messages.append({"role": "user", "content": f"Content of {url}:\n{result}"})
            elif action == "research_topic":
                topic = args.get('topic', '')
                helper.log_live("action", f"Researching: {topic}", {"topic": topic})
                
                # Enhanced user feedback: Indicate research start and encourage observation of detailed steps.
                progress_message_start = f"\x1b[36m[*] Initiating deep research on '{topic}'. Observe detailed step progress below...\x1b[0m"
                print(progress_message_start)
                helper.log_console(progress_message_start)

                # The research_engine.execute_staircase method itself prints detailed step-by-step progress.
                result = research_engine.execute_staircase(topic) 
                
                # Confirmation message after research completion.
                progress_message_end = f"\x1b[36m[*] Deep research on '{topic}' completed.\x1b[0m"
                print(progress_message_end)
                helper.log_console(progress_message_end)

                # Convert the result dict to a readable string for the agent's context.
                formatted_result = json.dumps(result, indent=2)
                messages.append({"role": "user", "content": f"Research Results:\n{formatted_result}"})
            elif action == "ethub_return":
                sub = args.get('sub', '')
                point_id = args.get('point_id', '')
                target = args.get('target', '')
                helper.log_live("action", f"Recovery Action: {sub} {point_id or target}", {"sub": sub, "point_id": point_id, "target": target})
                text = f"\x1b[31m[*] Executing recovery {sub}...\x1b[0m"
                print(text)
                helper.log_console(text)
                result = ethub_return_action(sub, point_id, target)
                messages.append({"role": "user", "content": f"Result of recovery {sub}:\n{result}"})
            else:
                messages.append({"role": "user", "content": f"Unknown action: {action}. Please use web_search, fetch_url, ethub_action, ethub_return, or final_answer."})
        except json.JSONDecodeError:
            helper.print_error("Agent did not return valid JSON. Retrying...")
            messages.append({"role": "user", "content": "Your previous response was not valid JSON. You MUST return ONLY a JSON object."})
            
        steps += 1
        
    if steps >= max_steps:
        helper.print_warning("Agent reached maximum steps and stopped.")

def handle_command(cmd_input, messages):
    parts = cmd_input.split()
    cmd = parts[0].lower()
    
    if cmd == "/exit":
        return "exit"
    elif cmd == "/help":
        help_text = (
            "/help       - Show this help\n"
            "/exit       - Exit interactive mode\n"
            "/clear      - Clear the screen\n"
            "/settings   - View current settings\n"
            "/set k v    - Update a setting (e.g., /set model llama3)\n"
            "/search q   - Perform a manual web search\n"
            "/sysinfo    - Show system information\n"
            "/train cmd  - Manage training data (add, list, clear, import)\n"
            "/return cmd - System Recovery (list, <point_id>)\n"
            "/web cmd    - Web Dashboard (start, stop)\n"
            "/ollama cmd - Help for Ollama"
        )
        print(helper.format_box(help_text, title="ETHUB SURGICAL COMMANDS"))
    elif cmd == "/clear":
        helper.clear_screen()
    elif cmd == "/settings":
        settings = config.list_settings()
        print(helper.format_box(json.dumps(settings, indent=4), title="Settings"))
    elif cmd == "/set":
        if len(parts) >= 3:
            key = parts[1]
            val = parts[2]
            # Try to parse numeric or boolean values
            if val.lower() == "true": val = True
            elif val.lower() == "false": val = False
            elif val.isdigit(): val = int(val)
            config.set(key, val)
            helper.print_success(f"Setting '{key}' updated to '{val}'")
        else:
            helper.print_error("Usage: /set <key> <value>")
    elif cmd == "/search":
        query = " ".join(parts[1:])
        if query:
            helper.print_info(f"Searching for: {query}")
            results = web_search(query)
            print(helper.format_box(results, title="Search Results"))
        else:
            helper.print_error("Usage: /search <query>")
    elif cmd == "/sysinfo":
        info = helper.get_system_info()
        print(helper.format_box(json.dumps(info, indent=4), title="System Info"))
    elif cmd == "/train":
        training_file = "agent-data/training.json"
        if len(parts) > 1:
            sub_cmd = parts[1].lower()
            if sub_cmd == "add":
                content = " ".join(parts[2:])
                if content:
                    data = []
                    if os.path.exists(training_file) and os.path.getsize(training_file) > 0:
                        try:
                            with open(training_file, "r") as f: data = json.load(f)
                        except: data = []
                    data.append(content)
                    with open(training_file, "w") as f: json.dump(data, f, indent=4)
                    helper.print_success(f"Added to training data: {content[:50]}...")
                else:
                    helper.print_error("Usage: /train add <content>")
            elif sub_cmd == "list":
                if os.path.exists(training_file) and os.path.getsize(training_file) > 0:
                    try:
                        with open(training_file, "r") as f: data = json.load(f)
                        print(helper.format_box("\n".join([f"{i+1}. {item[:100]}..." for i, item in enumerate(data)]), title="Training Data"))
                    except Exception as e:
                        helper.print_error(f"Error reading training data: {e}")
                else:
                    helper.print_info("No training data found.")
            elif sub_cmd == "clear":
                with open(training_file, "w") as f: json.dump([], f, indent=4)
                helper.print_success("Training data cleared.")
            elif sub_cmd == "import":
                if len(parts) > 2:
                    import_path = parts[2]
                    if os.path.exists(import_path):
                        try:
                            import_data_list = []
                            # Handle ZIP files
                            if import_path.lower().endswith(".zip"):
                                with zipfile.ZipFile(import_path, 'r') as z:
                                    # Look for conversations.json in the ZIP
                                    for filename in z.namelist():
                                        if filename.endswith("conversations.json"):
                                            with z.open(filename) as f:
                                                import_data_list.append(json.load(f))
                                if not import_data_list:
                                    helper.print_warning("No 'conversations.json' found inside the ZIP file.")
                            else:
                                # Handle raw JSON file
                                with open(import_path, "r") as f:
                                    import_data_list.append(json.load(f))
                            
                            total_new_items = 0
                            data = []
                            if os.path.exists(training_file) and os.path.getsize(training_file) > 0:
                                try:
                                    with open(training_file, "r") as f: data = json.load(f)
                                except: data = []
                                
                            for import_data in import_data_list:
                                new_items = []
                                # Handle ChatGPT conversations.json format
                                if isinstance(import_data, list):
                                    for conv in import_data:
                                        if "mapping" in conv:
                                            for node_id in conv["mapping"]:
                                                node = conv["mapping"][node_id]
                                                if node.get("message") and node["message"].get("content") and node["message"]["content"].get("parts"):
                                                    text = " ".join([p for p in node["message"]["content"]["parts"] if isinstance(p, str)])
                                                    if text.strip():
                                                        new_items.append(text.strip())
                                
                                if new_items:
                                    data.extend(new_items)
                                    total_new_items += len(new_items)
                                    
                            if total_new_items > 0:
                                with open(training_file, "w") as f: json.dump(data, f, indent=4)
                                helper.print_success(f"Imported {total_new_items} items from {import_path}")
                            else:
                                helper.print_warning("No valid text found in the import source.")
                        except Exception as e:
                            helper.print_error(f"Import failed: {e}")
                    else:
                        helper.print_error(f"File not found: {import_path}")
                else:
                    helper.print_error("Usage: /train import <file_path>")
        else:
            helper.print_info("Usage: /train [add|list|clear|import] [content|file]")
    elif cmd == "/return":
        if len(parts) > 1:
            sub = parts[1].lower()
            if sub == "list":
                points = return_engine.list_return_points()
                print(helper.format_box("\n".join(points), title="Return Points"))
            else:
                # Assume it's an ID
                print(return_engine.restore_to(parts[1]))
        else:
            helper.print_error("Usage: /return [list | <point_id>]")
    elif cmd == "/web":
        from core.web_server import run_web_ui, stop_web_ui
        sub_cmd = parts[1].lower() if len(parts) > 1 else "start"
        
        if sub_cmd == "start":
            port = int(parts[2]) if len(parts) > 2 else 8080
            run_web_ui(port=port)
            # helper.print_success(f"Web Dashboard server started at http://localhost:{port}")
        elif sub_cmd == "stop":
            if stop_web_ui():
                helper.print_success("Web Dashboard server stopped.")
            else:
                helper.print_warning("Web Dashboard server is not running.")
        else:
            helper.print_error("Usage: /web [start|stop] [port]")
    elif cmd == "/ollama":
        if len(parts) > 1 and parts[1] == "pull":
            model = parts[2] if len(parts) > 2 else config.get("model")
            helper.print_info(f"Attempting to pull model: {model}")
            # Ollama pull implementation via urllib
            ollama_url = config.get("ollama_url").replace("/chat", "/pull")
            try:
                data = json.dumps({"name": model}).encode('utf-8')
                req = urllib.request.Request(ollama_url, data=data)
                with urllib.request.urlopen(req) as response:
                    print("Pulling started... (check Ollama server logs for progress)")
            except Exception as e:
                helper.print_error(f"Ollama pull failed: {e}")
        else:
            helper.print_info("Ollama Commands: /ollama pull [model]")
    else:
        helper.print_error(f"Unknown command: {cmd}")
    return None

def completer(text, state):
    commands = ['/help', '/exit', '/clear', '/settings', '/set', '/search', '/sysinfo', '/train', '/return', '/web', '/ollama']
    if not text:
        # If no text is typed, Tab will suggest /return
        return "/return" if state == 0 else None
    
    matches = [c for c in commands if c.startswith(text)]
    if state < len(matches):
        return matches[state]
    return None

def main():
    parser = argparse.ArgumentParser(description="ETHUB CLI - Advanced Terminal Agent")
    parser.add_argument("query", nargs="?", help="The question or task for the agent")
    parser.add_argument("--interactive", "-i", action="store_true", help="Start interactive mode")
    parser.add_argument("--no-intro", action="store_true", help="Skip the intro animation")
    
    args = parser.parse_args()
    
    if not args.query and not args.interactive:
        parser.print_help()
        sys.exit(1)
        
    initial_dir = os.getcwd()
    
    # Run intro only if not skipped
    if not args.no_intro and sys.stdout.isatty():
        from ui.rainbow_animation import draw_header
        # Small animation at start
        run_intro(initial_dir=initial_dir, frames=30)
    
    helper.print_info(f"ETHUB CLI Agent initialized. Model: {config.get('model')}")
    
    if args.interactive:
        # Auto-start Web UI
        from core.web_server import run_web_ui
        run_web_ui(port=8080)
        # helper.print_success("Web Dashboard active on port 8080")

        # Setup Tab key for Rollback / Autocomplete
        readline.parse_and_bind("tab: complete")
        readline.set_completer(completer)
        
        helper.print_info("Terminal Mode Active. Type '/help' for commands. Press 'Tab' to easily rollback.")
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        from core.web_server import _httpd
        
        while True:
            try:
                # Optionally redraw header at the top
                # print("\x1b[H", end="") 
                
                status_tag = f"\x1b[90m[WEB]\x1b[0m " if _httpd else ""
                user_input = input(f"\n{status_tag}\x1b[32mETHUB>\x1b[0m ").strip()
                if not user_input:
                    continue
                
                if user_input.startswith("/"):
                    status = handle_command(user_input, messages)
                    if status == "exit":
                        break
                    continue
                    
                messages.append({"role": "user", "content": user_input})
                run_agent_loop(messages, query=user_input)
            except (KeyboardInterrupt, EOFError):
                print("\nExiting...")
                break
    else:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": args.query}
        ]
        run_agent_loop(messages, query=args.query)

if __name__ == "__main__":
    main()
