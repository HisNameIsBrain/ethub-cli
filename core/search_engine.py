import webbrowser
import urllib.parse
import urllib.request
import json
import os
from datetime import datetime
from core.config_engine import ConfigEngine

class SearchEngine:
    def __init__(self, results_file="agent-data/results.json"):
        self.results_file = results_file
        self.config = ConfigEngine()

    def execute(self, action_details):
        """Executes the web search action with mothership KB fallback."""
        query = action_details.get("query")
        
        # 1. Try Mothership Knowledge Base first if enabled
        if self.config.get("knowledge_base_access"):
            kb_results = self._query_mothership(query)
            if kb_results:
                print(f"Mothership KB hits for: {query}")
                self._store_results(query, kb_results)
                return kb_results

        # 2. Fallback to smart web search
        sources = action_details.get("sources", self.config.get("search_engines", ["google"]))
        results = []
        for engine in sources:
            url = self._get_url(engine, query)
            if url:
                print(f"Searching {engine} for: {query}")
                # We can't use webbrowser in a headless mothership usually, 
                # but we'll keep it for local user fallback.
                try:
                    webbrowser.open(url)
                except: pass
                results.append({"engine": engine, "url": url})
        
        self._store_results(query, results)
        return results

    def _query_mothership(self, query):
        """Queries the mothership IP for knowledge base access."""
        if self.config.get("is_mothership"):
            # If we are the mothership, search locally
            from core.web_server import WebHandler
            # We can't easily call WebHandler method without an instance, 
            # so let's implement a standalone local search or just use a dummy for now.
            return self._local_kb_search(query)
        
        mothership_ip = self.config.get("mothership_ip")
        url = f"http://{mothership_ip}:8080/api/kb"
        try:
            req = urllib.request.Request(url, headers={"X-Query": query})
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))
        except:
            return None

    def _local_kb_search(self, query):
        """Local search when acting as mothership."""
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


    def _get_url(self, engine, query):
        encoded_query = urllib.parse.quote(query)
        engines = {
            "google": f"https://www.google.com/search?q={encoded_query}",
            "github": f"https://github.com/search?q={encoded_query}",
            "wiki": f"https://en.wikipedia.org/wiki/Special:Search?search={encoded_query}",
            "substack": f"https://substack.com/search/{encoded_query}",
            "chatgpt": f"https://chatgpt.com/?q={encoded_query}",
            "stackoverflow": f"https://stackoverflow.com/search?q={encoded_query}",
            "dev.to": f"https://dev.to/search?q={encoded_query}"
        }
        return engines.get(engine.lower())

    def _store_results(self, query, results):
        """Store results locally."""
        if not os.path.exists(os.path.dirname(self.results_file)):
            os.makedirs(os.path.dirname(self.results_file), exist_ok=True)
            
        history = []
        if os.path.exists(self.results_file):
            try:
                with open(self.results_file, "r") as f:
                    history = json.load(f)
            except: pass
            
        history.append({
            "timestamp": datetime.now().isoformat(),
            "query": query,
            "results": results
        })
        
        with open(self.results_file, "w") as f:
            json.dump(history, f, indent=4)
