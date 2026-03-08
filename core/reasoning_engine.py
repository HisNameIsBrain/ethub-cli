import json
import ollama

class ReasoningEngine:
    def __init__(self, model="qwen2.5:0.5b"):
        self.model = model

    def analyze(self, query):
        """Uses local Ollama to classify the intent of the ETHUB request."""
        try:
            # System prompt ensures the model acts as part of the ETHUB core
            response = ollama.chat(model=self.model, messages=[
                {
                    'role': 'system', 
                    'content': 'You are the ETHUB Reasoning Engine. Classify queries into: code_query, hardware_query, or general_query. Reply ONLY with a JSON object: {"query_type": "type", "intent": "intent", "keywords": ["kw1", "kw2"]}'
                },
                {'role': 'user', 'content': query}
            ])
            
            # Cleanly parse the model's JSON response
            raw_content = response['message']['content']
            
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
