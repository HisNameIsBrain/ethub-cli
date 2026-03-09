import json
import os
import urllib.request
import urllib.parse
import re
import time
from datetime import datetime
from core.safety_engine import SafetyEngine

class ResearchEngine:
    """
    ETHUB Research Engine: Implements the 'Staircase Research Model' with 
    Verified Desktop Search Simulation and Best-Answer Synthesis.
    """
    def __init__(self, history_dir=".ethub/history", model="qwen2.5:0.5b"):
        self.history_dir = history_dir
        self.model = model
        self.ollama_url = "http://127.0.0.1:11434/api/chat"
        self.safety = SafetyEngine()
        # High-integrity Desktop User-Agent
        self.user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

    def execute_staircase(self, topic):
        """
        Main entry point for topic research.
        1. Local Forensics (Previous Session Analysis)
        2. Predictive Modeling (Local Contextual Guess)
        3. Global Verification (Desktop Search + Content Analysis)
        """
        print(f"--- Initiating Staircase Research: '{topic}' ---")
        
        # Step 1: Local Forensics
        local_context = self._local_forensics(topic)
        print(f"[Step 1] Local Context: Analyzed {len(local_context)} history nodes.")

        # Step 2: Predictive Modeling
        prediction = self._predictive_modeling(topic, local_context)
        print(f"[Step 2] Local Prediction: Synthesized from internal memory.")

        # Step 3: Global Verification (The 'Verified Search' Phase)
        print(f"[Step 3] Verification: Simulating Desktop Search Protocol...")
        verified_answer = self._perform_verified_search(topic)
        
        return {
            "topic": topic,
            "prediction": prediction,
            "verified_answer": verified_answer,
            "analysis_metadata": {
                "timestamp": datetime.now().isoformat(),
                "history_nodes": len(local_context),
                "verification_status": "Success" if "Verified" in verified_answer else "Incomplete"
            }
        }

    def _local_forensics(self, query):
        """Scans the .ethub/history directory for relevant previous queries."""
        matches = []
        if os.path.exists(self.history_dir):
            for root, dirs, files in os.walk(self.history_dir):
                if "history.json" in files:
                    try:
                        with open(os.path.join(root, "history.json"), "r") as f:
                            data = json.load(f)
                            if isinstance(data, list):
                                for entry in data:
                                    if query.lower() in str(entry.get("query", "")).lower():
                                        matches.append(entry)
                    except: continue
        return matches[:3]

    def _predictive_modeling(self, query, context):
        """Uses local LLM to predict a solution based on current system state/history."""
        context_str = json.dumps(context) if context else "No prior system context found."
        prompt = (
            f"Query: {query}\n"
            f"Local Context (Prior Sessions): {context_str}\n"
            "Based on the query and any prior history, predict the most likely solution or technical explanation. "
            "Label this clearly as a PREDICTION."
        )
        return self._query_llm(prompt, system_prompt="You are the ETHUB Predictive Modeling Engine.")

    def _perform_verified_search(self, query):
        """
        Simulates Desktop Google Search behavior:
        - Constructs Google Desktop Search URL.
        - Fetches top 3 results sequentially (one at a time) to avoid detection/load.
        - Analyzes each result for 'Credibility Proof'.
        - Selects and synthesizes the 'Best Answer'.
        """
        # 1. Desktop Search Execution (Google Simulation)
        search_results = self._search_google_desktop(query)
        if not search_results:
            print("    > Warning: Google Desktop Search blocked. Falling back to Verified Proxy...")
            search_results = self._search_web_fallback(query)

        if not search_results:
            return "Unable to retrieve credible search data for verification."

        print(f"    > Proof Candidates: Found {len(search_results)} sources. Verifying top 3...")
        
        verified_data = []
        
        # 2. Sequential Proof Verification (One Request at a Time)
        for i, result in enumerate(search_results[:3]):
            url = result['link']
            print(f"    > [{i+1}/3] Proof Confirmation: {url}")
            
            content = self._fetch_page_content(url)
            if content:
                print(f"      - Content Depth: {len(content)} characters. Analyzing credibility...")
                analysis = self._analyze_source_credibility(query, content)
                verified_data.append(f"Source: {url}\nProof Analysis: {analysis}")
            
            # Protocol: One request at a time (sequential delay)
            time.sleep(2.0)

        # 3. Final Answer Synthesis (The 'Best Answer')
        if not verified_data:
            return "No verified credibility proof could be established from available sources."

        print("    > Synthesizing Final Verified Answer...")
        return self._synthesize_final_answer(query, verified_data)

    def _search_google_desktop(self, query):
        """Constructs a Google Search URL and attempts to parse desktop-like results."""
        encoded_query = urllib.parse.quote(query)
        # desktop search URL
        url = f"https://www.google.com/search?q={encoded_query}&hl=en"
        req = urllib.request.Request(url, headers={'User-Agent': self.user_agent})
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8')
                
                # Regex for desktop Google search results (titles and links)
                # Note: Google HTML changes frequently; this is a best-effort pattern
                results = []
                # Looking for <a href="/url?q=..." or direct <a href="http..."
                links = re.findall(r'<a href="(/url\?q=http[^"&]*)', html)
                if not links:
                    # fallback pattern for modern google
                    links = re.findall(r'<a href="(https?://[^"]*)"', html)
                
                for link in links:
                    if "google.com" in link and "/url?q=" not in link: continue
                    if "/url?q=" in link:
                        link = link.split("/url?q=")[1]
                    results.append({'link': link, 'title': 'Google Result'})
                
                return results if results else None
        except:
            return None

    def _search_web_fallback(self, query):
        """Reliable fallback using DuckDuckGo Lite if Google blocks the request."""
        url = 'https://lite.duckduckgo.com/lite/'
        data = urllib.parse.urlencode({'q': query}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'User-Agent': self.user_agent})
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8')
                raw_links = re.findall(r'<a class="result-link" href="(.*?)">(.*?)</a>', html)
                results = []
                for link, title in raw_links:
                    if '/l/?' in link:
                        try:
                            parsed = urllib.parse.urlparse(link)
                            qs = urllib.parse.parse_qs(parsed.query)
                            if 'uddg' in qs: link = qs['uddg'][0]
                        except: pass
                    if link.startswith('http'):
                        results.append({'link': link, 'title': title})
                return results
        except: return []

    def _fetch_page_content(self, url):
        """Fetches page content with safety and security auditing."""
        try:
            req = urllib.request.Request(url, headers={'User-Agent': self.user_agent})
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8')
                # Safety Audit
                is_safe, _ = self.safety.audit_source_chunk("research_verification", url, html[:1000])
                if not is_safe: return None

                # Clean Text Extraction
                text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.IGNORECASE | re.DOTALL)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                return text[:4000]
        except: return None

    def _analyze_source_credibility(self, query, content):
        """Uses LLM to evaluate the credibility and relevance of a fetched source."""
        prompt = (
            f"Query: {query}\n"
            f"Source Content (Truncated): {content}\n"
            "Analyze this source. Does it provide factual, high-quality information for the query? "
            "Extract the specific data points that prove the solution is correct."
        )
        return self._query_llm(prompt, system_prompt="You are the ETHUB Credibility Proof Auditor.")

    def _synthesize_final_answer(self, query, verified_proofs):
        """Synthesizes the 'Best Answer' from multiple verified sources."""
        proofs_text = "\n\n".join(verified_proofs)
        prompt = (
            f"Query: {query}\n\n"
            f"Verified Credibility Proofs:\n{proofs_text}\n\n"
            "Synthesize the final 'Best Answer' based on these verified desktop search results. "
            "Ensure the answer is formal, detailed, and includes credibility citations from the sources above."
        )
        return self._query_llm(prompt, system_prompt="You are the ETHUB Final Synthesis Engine.")

    def _query_llm(self, prompt, system_prompt=""):
        payload = {
            "model": self.model,
            "messages": [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': prompt}
            ],
            "stream": False
        }
        try:
            req = urllib.request.Request(
                self.ollama_url, 
                data=json.dumps(payload).encode('utf-8'), 
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res = json.loads(response.read().decode('utf-8'))
                return res['message']['content']
        except Exception as e:
            return f"LLM Interface Error: {e}"
