import difflib
import os

class PatchEngine:
    def __init__(self, safety_engine):
        self.safety_engine = safety_engine

    def generate_patch(self, file_path, new_content, query):
        """Generates a minimal diff-only patch."""
        if "../" in file_path or file_path.startswith("/root") or file_path.startswith("/system"):
            return {"file_path": file_path, "patch": "", "is_safe": False, "risks": ["File traversal attempt blocked by PatchEngine."]}

        if not os.path.exists(file_path):
            # For new files, the diff is the entire content
            old_content = ""
        else:
            with open(file_path, "r") as f:
                old_content = f.read()
        
        diff = list(difflib.unified_diff(
            old_content.splitlines(keepends=True),
            new_content.splitlines(keepends=True),
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}"
        ))
        
        patch_text = "".join(diff)
        
        # Security Audit of the patch itself
        safe, risks = self.safety_engine.audit_source_chunk(query, f"local_patch:{file_path}", patch_text)
        
        return {
            "file_path": file_path,
            "patch": patch_text,
            "is_safe": safe,
            "risks": risks
        }

    def apply_patch(self, file_path, new_content):
        """Applies the patch by writing the new content."""
        if "../" in file_path or file_path.startswith("/root") or file_path.startswith("/system"):
            return False

        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        with open(file_path, "w") as f:
            f.write(new_content)
        return True
