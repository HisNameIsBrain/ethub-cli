import json
import os
import re
from datetime import datetime

class SafetyEngine:
    def __init__(self, rules_file="rules/rules.json", risks_file="agent-data/dependabot-risks.json"):
        self.rules_file = rules_file
        self.risks_file = risks_file
        self.rules = self._load_rules()
        self.allowed_domains = [
            "github.com", "dev.to", "substack.com", "wikipedia.org", 
            "google.com", "youtube.com"
        ]

    def _load_rules(self):
        if not os.path.exists(self.rules_file):
            return {"deny_patterns": ["exec(", "eval(", "os.system", "subprocess", "rm -rf /"]}
        try:
            with open(self.rules_file, "r") as f: return json.load(f)
        except: return {"deny_patterns": ["exec(", "eval(", "os.system", "subprocess", "rm -rf /"]}

    def audit_source_chunk(self, query, source, chunk):
        """Complete 8-point Security Audit Pipeline."""
        risks = []
        
        # 1. Source domain verification
        domain_match = re.search(r'https?://([^/]+)', source)
        if domain_match:
            domain = domain_match.group(1).lower()
            if not any(d in domain for d in self.allowed_domains):
                risks.append(f"Untrusted source domain: {domain}")

        # 2. HTML URL / script inspection (Basic detection for hidden scripts)
        if "<script" in chunk.lower() or "javascript:" in chunk.lower():
            risks.append("Potential malicious script injection detected in source.")

        # 3. Unwanted/Risky command injection detection
        deny_patterns = self.rules.get("deny_patterns", [])
        for pattern in deny_patterns:
            if pattern in chunk:
                risks.append(f"Risky pattern '{pattern}' detected in source content.")

        # 4. Hidden prompt injection detection (Looking for system prompt overrides)
        if any(x in chunk.lower() for x in ["ignore previous instructions", "system role", "bypass safety"]):
            risks.append("Potential prompt injection attempt detected.")

        # 5. Env secrets or keys requests detection
        if any(x in chunk.lower() for x in ["api_key", "secret_key", "password", ".env", "process.env"]):
            risks.append("Attempt to access secrets or environment variables detected.")

        # 6. Validity of dependency source
        if "npm install" in chunk or "pip install" in chunk:
            if not any(d in source for d in ["npmjs.com", "github.com", "pypi.org"]):
                risks.append("Suspicious dependency installation source detected.")

        # 7. Unsafe shell instructions
        if re.search(r'rm\s+-rf\s+|>\s*/dev/null|curl\s+.*\s*\|\s*bash', chunk):
            risks.append("Unsafe shell command pattern detected.")

        # 8. File traversal attempts
        if "../" in chunk or "/etc/passwd" in chunk or "/root" in chunk:
            risks.append("File traversal attempt detected.")

        if risks:
            self._log_risk(query, source, "source_chunk_audit", risks)
            return False, risks
        
        return True, []

    def _log_risk(self, query, source, risk_type, risks):
        history = []
        if os.path.exists(self.risks_file):
            try:
                with open(self.risks_file, "r") as f: history = json.load(f)
            except: pass
            
        history.append({
            "timestamp": datetime.now().isoformat(),
            "query": query,
            "source": source,
            "risk_type": risk_type,
            "severity": "high" if risks else "low",
            "description": "; ".join(risks),
            "action": "denied",
            "recommended_patch": "Audit content for malicious patterns",
            "notes": "Action blocked to maintain system integrity"
        })
        
        if not os.path.exists(os.path.dirname(self.risks_file)):
            os.makedirs(os.path.dirname(self.risks_file), exist_ok=True)
            
        with open(self.risks_file, "w") as f:
            json.dump(history, f, indent=4)

    def perform_surgical_audit(self, fix_cmds, diff_patch):
        """[FIELD: SURGICAL_AUDIT] - Audit a proposed fix for risky patterns."""
        risks = []
        combined = f"{fix_cmds}\n{diff_patch}"
        
        # Check for absolute path deletions
        if re.search(r'rm\s+-rf\s+/', combined):
            risks.append("CRITICAL: Root directory deletion detected.")
        
        # Check for system file access
        if any(x in combined for x in ["/etc/shadow", "/etc/passwd", ".ssh/"]):
            risks.append("HIGH: Attempt to access sensitive system files.")
            
        # Check for curl | bash
        if re.search(r'curl\s+.*\s*\|\s*bash', combined):
            risks.append("MEDIUM: Potential unsafe remote script execution.")

        if not risks:
            return True, "No critical risks detected. Patch is surgically sound."
        return False, "; ".join(risks)
