import json

class ReasoningEngine:
    def __init__(self):
        self.code_keywords = ["fix", "code", "syntax", "error", "bug", "implement", "function", "class", "npm", "pip", "git", "react", "python", "node"]
        self.info_keywords = ["what is", "how to", "why", "who", "when", "tell me about", "define", "meaning"]

    def analyze(self, query):
        """Analyze query and classify as Code Query or Information Query."""
        query_lower = query.lower()
        
        # Classification
        is_code = any(word in query_lower for word in self.code_keywords)
        is_info = any(word in query_lower for word in self.info_keywords)
        
        # If both or neither, check for specific code indicators like file extensions or CamelCase/snake_case
        if (is_code and is_info) or (not is_code and not is_info):
            if any(ext in query_lower for ext in [".py", ".js", ".html", ".css", ".ts", ".json"]):
                query_type = "code_query"
            else:
                query_type = "info_query"
        elif is_code:
            query_type = "code_query"
        else:
            query_type = "info_query"

        intent = "debugging" if "error" in query_lower or "fix" in query_lower else "general_request"
        keywords = [word for word in query_lower.split() if len(word) > 3]
        
        reasoning = {
            "query": query,
            "query_type": query_type,
            "intent": intent,
            "keywords": keywords,
            "search_strategy": "URL-only source fetching"
        }
        
        return reasoning
