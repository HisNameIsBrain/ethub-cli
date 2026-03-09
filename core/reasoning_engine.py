import json
import urllib.request
import os

class ReasoningEngine:
    def __init__(self, model="qwen2.5:0.5b", ollama_url="http://127.0.0.1:11434/api/chat", timeout=120):
        self.model = model
        self.ollama_url = ollama_url
        self.timeout = timeout

    def analyze(self, query):
        """Uses local Ollama via urllib to classify the intent of the ETHUB request."""
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {
                        'role': 'system', 
                        'content': 'You are the ETHUB Reasoning Engine. Classify queries into: code_query, hardware_query, or general_query. Reply ONLY with a JSON object: {"query_type": "type", "intent": "intent", "keywords": ["kw1", "kw2"]}'
                    },
                    {'role': 'user', 'content': query}
                ],
                "stream": False
            }
            
            req = urllib.request.Request(
                self.ollama_url, 
                data=json.dumps(payload).encode('utf-8'), 
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                res = json.loads(response.read().decode('utf-8'))
                raw_content = res['message']['content']
            
            # Attempt to parse JSON from the response
            try:
                # Basic cleanup if model adds markdown formatting
                if "```json" in raw_content:
                    raw_content = raw_content.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_content:
                    raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
                reasoning = json.loads(raw_content)
            except:
                # Fallback classification logic
                q_type = "code_query" if any(x in raw_content.lower() for x in ["code", "debug", "error"]) else "general_query"
                if "hardware" in raw_content.lower(): q_type = "hardware_query"
                reasoning = {
                    "query_type": q_type,
                    "intent": "general_request",
                    "keywords": [word for word in query.lower().split() if len(word) > 3]
                }
            
            reasoning["query"] = query
            reasoning["search_strategy"] = "LLM-driven URL source fetching"
            return reasoning
            
        except Exception as e:
            # Complete safety fallback
            return {
                "query": query,
                "query_type": "general_query",
                "intent": "fallback",
                "keywords": [],
                "error": str(e)
            }
