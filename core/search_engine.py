import webbrowser
import urllib.parse
import json
import os
from datetime import datetime

class SearchEngine:
    def __init__(self, results_file="storage/results.json"):
        self.results_file = results_file

    def execute(self, action_details):
        """Executes the web search action."""
        query = action_details.get("query")
        sources = action_details.get("sources", [])
        
        results = []
        for engine in sources:
            url = self._get_url(engine, query)
            if url:
                print(f"Searching {engine} for: {query}")
                webbrowser.open(url)
                results.append({"engine": engine, "url": url})
        
        self._store_results(query, results)
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
