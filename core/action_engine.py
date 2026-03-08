import ollama
import json

class ActionEngine:
    def __init__(self, model="qwen2.5:0.5b"):
        self.model = model

    def decide_actions(self, reasoning):
        """Decide what operations to perform based on reasoning via Ollama."""
        try:
            prompt = f"Based on this reasoning: {json.dumps(reasoning)}, what search sources should be used? Available: google, github, stackoverflow, dev.to, wikipedia, substack, npm. Reply ONLY with a JSON object: {{\"action\": \"web_search\", \"sources\": [\"source1\", \"source2\"]}}"
            
            response = ollama.chat(model=self.model, messages=[
                {'role': 'system', 'content': 'You are the ETHUB Action Engine. Select the best information sources for a query.'},
                {'role': 'user', 'content': prompt}
            ])
            
            raw_content = response['message']['content']
            
            try:
                # Basic cleanup if model adds markdown formatting
                if "```json" in raw_content:
                    raw_content = raw_content.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_content:
                    raw_content = raw_content.split("```")[1].split("```")[0].strip()
                
                return json.loads(raw_content)
            except:
                # Fallback logic if LLM fails
                intent = reasoning.get("intent", "general")
                sources = ["google"]
                if intent == "debugging":
                    sources.extend(["github", "stackoverflow"])
                elif intent == "code_query":
                    sources.extend(["github", "npm"])
                
                return {"action": "web_search", "sources": list(set(sources))}
                
        except Exception as e:
            return {"action": "web_search", "sources": ["google"], "error": str(e)}
