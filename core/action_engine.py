class ActionEngine:
    def __init__(self):
        pass

    def decide_actions(self, reasoning):
        """Decide what operations to perform based on reasoning."""
        intent = reasoning.get("intent")
        
        sources = ["google"]
        if intent == "debugging":
            sources.extend(["github", "stackoverflow", "chatgpt"])
        elif intent == "tutorial":
            sources.extend(["github", "dev.to"])
        elif intent == "informational":
            sources.extend(["wiki", "substack"])
        
        actions = {
            "action": "web_search",
            "sources": list(set(sources)) # Unique sources
        }
        
        return actions
