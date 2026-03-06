import json
import os
from datetime import datetime

class ApprovalEngine:
    def __init__(self, approvals_file="storage/approvals.json"):
        self.approvals_file = approvals_file

    def ask(self, action_details):
        """Asks for approval from the user before executing an action."""
        action = action_details.get("action")
        sources = action_details.get("sources", [])
        
        print(f"\n\x1b[38;5;214mAction proposed:\x1b[0m {action}")
        print(f"\x1b[38;5;81mSources:\x1b[0m {', '.join(sources)}")
        
        choice = input("\x1b[38;5;81mApprove execution? (y/n): \x1b[0m").strip().lower()
        
        approved = choice == 'y'
        
        # Log approval
        self._log_approval(action_details, approved)
        
        return approved

    def _log_approval(self, action_details, approved):
        """Logs the approval or denial to approvals.json."""
        if not os.path.exists(os.path.dirname(self.approvals_file)):
            os.makedirs(os.path.dirname(self.approvals_file), exist_ok=True)
            
        history = []
        if os.path.exists(self.approvals_file):
            try:
                with open(self.approvals_file, "r") as f:
                    history = json.load(f)
            except: pass
            
        history.append({
            "timestamp": datetime.now().isoformat(),
            "action_details": action_details,
            "approved": approved
        })
        
        if len(history) > 50: history.pop(0)
        
        with open(self.approvals_file, "w") as f:
            json.dump(history, f, indent=4)
