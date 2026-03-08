#!/usr/bin/env python3
import json
import urllib.request
import urllib.parse
import urllib.error
import argparse
import sys
import re
from html.parser import HTMLParser

OLLAMA_URL = "http://127.0.0.1:11434/api/pull"
MODEL = "qwen2.5:0.5b"

SYSTEM_PROMPT = """You are an autonomous AI agent with web search capabilities.
You run in a terminal and must help the user by finding information on the web.
You have access to the following tools:
1. "web_search": Searches the internet. Requires argument "query".
2. "fetch_url": Fetches text content from a specific URL. Requires argument "url".
3. "final_answer": Provides the final response to the user. Requires argument "text".

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
    try:
        with urllib.request.urlopen(req) as response:
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

def fetch_url(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.IGNORECASE | re.DOTALL)
            if body_match:
                html = body_match.group(1)
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.IGNORECASE | re.DOTALL)
            html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.IGNORECASE | re.DOTALL)
            text = strip_tags(html)
            text = re.sub(r'\s+', ' ', text)
            return text[:3000]
    except Exception as e:
        return f"Fetch failed: {e}"

def chat_with_ollama(messages):
    data = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "format": "json"
    }
    try:
        req = urllib.request.Request(OLLAMA_URL, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res['message']['content']
    except urllib.error.URLError as e:
        return json.dumps({"action": "final_answer", "args": {"text": f"Error communicating with Ollama server at {OLLAMA_URL}. Is it running? Details: {e}"}})
    except Exception as e:
        return json.dumps({"action": "final_answer", "args": {"text": f"Error communicating with Ollama: {e}"}})

def run_agent_loop(messages):
    print("\n\x1b[35mAgent is thinking...\x1b[0m")
    steps = 0
    max_steps = 10
    
    while steps < max_steps:
        response_text = chat_with_ollama(messages)
        messages.append({"role": "assistant", "content": response_text})
        
        try:
            response_json = json.loads(response_text)
            thought = response_json.get("thought", "")
            action = response_json.get("action", "")
            args = response_json.get("args", {})
            
            if thought:
                print(f"\x1b[90mThought: {thought}\x1b[0m")
                
            if action == "final_answer":
                print(f"\n\x1b[36mAgent:\x1b[0m {args.get('text', '')}")
                break
            elif action == "web_search":
                query = args.get('query', '')
                print(f"\x1b[33m[*] Searching the web for: {query}\x1b[0m")
                result = web_search(query)
                messages.append({"role": "user", "content": f"Search Results for '{query}':\n{result}"})
            elif action == "fetch_url":
                url = args.get('url', '')
                print(f"\x1b[33m[*] Fetching URL: {url}\x1b[0m")
                result = fetch_url(url)
                messages.append({"role": "user", "content": f"Content of {url}:\n{result}"})
            else:
                messages.append({"role": "user", "content": f"Unknown action: {action}. Please use web_search, fetch_url, or final_answer."})
        except json.JSONDecodeError:
            print("\x1b[31mError: Agent did not return valid JSON. Retrying...\x1b[0m")
            messages.append({"role": "user", "content": "Your previous response was not valid JSON. You MUST return ONLY a JSON object."})
            
        steps += 1
        
    if steps >= max_steps:
        print("\n\x1b[31mAgent reached maximum steps and stopped.\x1b[0m")

def main():
    parser = argparse.ArgumentParser(description="ETHUB CLI - Isolated Terminal Agent")
    parser.add_argument("query", nargs="?", help="The question or task for the agent")
    parser.add_argument("--interactive", "-i", action="store_true", help="Start interactive mode")
    
    args = parser.parse_args()
    
    if not args.query and not args.interactive:
        parser.print_help()
        sys.exit(1)
        
    print(f"\x1b[36mETHUB CLI Agent initialized. Model: {MODEL}\x1b[0m")
    
    if args.interactive:
        print("Interactive mode started. Type 'exit' to quit.")
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        while True:
            try:
                user_input = input("\n\x1b[32mYou:\x1b[0m ")
                if user_input.lower() in ['exit', 'quit']:
                    break
                if not user_input.strip():
                    continue
                messages.append({"role": "user", "content": user_input})
                run_agent_loop(messages)
            except (KeyboardInterrupt, EOFError):
                break
    else:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": args.query}
        ]
        run_agent_loop(messages)

if __name__ == "__main__":
    main()
