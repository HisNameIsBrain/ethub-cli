import json
import os
import re
from core.reasoning_engine import ReasoningEngine
from core.action_engine import ActionEngine
from core.safety_engine import SafetyEngine
from core.snapshot_engine import SnapshotEngine
from core.config_engine import ConfigEngine

class HybridEngine:
    def __init__(self):
        self.config = ConfigEngine()
        model = self.config.get("model")
        ollama_url = self.config.get("ollama_url")
        timeout = self.config.get("timeout", 120)
        
        self.reasoner = ReasoningEngine(model=model, ollama_url=ollama_url, timeout=timeout)
        self.actor = ActionEngine(model=model, ollama_url=ollama_url, timeout=timeout)
        self.safety = SafetyEngine()
        self.snapshot = SnapshotEngine()
        self.training_file = "agent-data/training.json"

    def get_local_knowledge(self, query, top_k=3):
        """Simple keyword-based local knowledge retrieval from training.json."""
        if not os.path.exists(self.training_file):
            return ""
        
        try:
            with open(self.training_file, "r") as f:
                data = json.load(f)
        except:
            return ""
            
        keywords = [w.lower() for w in query.split() if len(w) > 3]
        matches = []
        for item in data:
            score = sum(1 for kw in keywords if kw in item.lower())
            if score > 0:
                matches.append((score, item))
        
        matches.sort(key=lambda x: x[0], reverse=True)
        relevant = [m[1] for m in matches[:top_k]]
        return "\n".join(relevant) if relevant else ""

    def process_query(self, query, messages):
        """The 'Hybris' Pipeline: Reason -> Local Knoweldge -> Action -> Execute."""
        
        # 1. Reasoning
        print("\x1b[90m[Hybris] Analyzing query intent...\x1b[0m")
        reasoning = self.reasoner.analyze(query)
        
        # 2. Local Knowledge Retrieval (RAG)
        local_info = self.get_local_knowledge(query)
        if local_info:
            print("\x1b[90m[Hybris] Found relevant local training data.\x1b[0m")
            knowledge_msg = f"Relevant Local Knowledge:\n{local_info}"
            # Inject into messages for the LLM's context
            messages.append({"role": "system", "content": knowledge_msg})

        # 3. Action Planning
        print("\x1b[90m[Hybris] Planning search strategy...\x1b[0m")
        actions = self.actor.decide_actions(reasoning)
        
        return reasoning, actions
