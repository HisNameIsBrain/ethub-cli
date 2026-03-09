# ETHUB CLI Library Documentation (v2.1 Surgical)

The ETHUB-CLI is designed to be completely isolated, utilizing only the Python Standard Library to ensure zero external dependencies and maximum security.

## Standard Libraries Used

### 1. `hashlib`
- **Function:** Secure hash and message digest algorithms.
- **Duty:** Used in `SurgicalActionEngine` to perform **SHA256 Integrity Checks** before and after every file modification.

### 2. `pathlib`
- **Function:** Object-oriented filesystem paths.
- **Duty:** Enforces **Path Isolation**, ensuring that all surgical actions are restricted to the project root and preventing directory traversal.

### 3. `json`
- **Function:** Serializing and deserializing data.
- **Duty:** Manages agent state, Return manifests, and JSON-based communication with the local Ollama model.

### 4. `urllib.request`, `urllib.parse`, `urllib.error`
- **Function:** Handling HTTP requests and network errors.
- **Duty:** Executes searches and fetches URL content without third-party dependencies like `requests`.

### 5. `re` (Regular Expressions)
- **Function:** Pattern matching and text manipulation.
- **Duty:** Performs surgical data extraction from web results and sanitizes content by stripping dangerous HTML blocks (`<script>`, `<style>`).

### 6. `shutil`
- **Function:** High-level file operations.
- **Duty:** Manages the creation of `.bak` snapshots and restoration of system Return Points.

### 7. `argparse`
- **Function:** Command-line argument parsing.
- **Duty:** Provides the professional CLI interface for interactive and single-query modes.

### 8. `datetime`
- **Function:** Basic date and time types.
- **Duty:** Generates unique, timestamped IDs for Surgical snapshots and Return manifests.

### 9. `html.parser`
- **Function:** Lightweight HTML parsing.
- **Duty:** Converts raw HTML to human-readable text while maintaining structural integrity.
