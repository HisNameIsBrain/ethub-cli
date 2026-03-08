# ETHUB CLI Library Documentation

The `ethub_cli.py` script has been redesigned to be completely isolated, utilizing only the Python Standard Library to ensure zero external dependencies and maximum portability.

## Standard Libraries Used

### 1. `json`
- **Function:** Serializing and deserializing data in JSON format.
- **Reasoning:** Essential for communicating with the Ollama API, which expects JSON payloads and returns JSON responses. It also facilitates structured communication between the reasoning engine and the agent's tool-use logic.
- **Imported at:** Line 2 (`import json`).
- **Duties:** 
    - Formatting the payload for `urllib.request` when calling Ollama.
    - Parsing the agent's JSON response to identify `thought`, `action`, and `args`.
    - Handling JSON decode errors gracefully with retries.

### 2. `urllib.request`, `urllib.parse`, `urllib.error`
- **Function:** Handling HTTP requests, URL encoding, and network-related errors.
- **Reasoning:** Replaces external libraries like `requests` and `httpx`. This ensures the script remains isolated and does not require `pip install` on the host system.
- **Imported at:** Lines 3-5 (`import urllib.request`, `import urllib.parse`, `import urllib.error`).
- **Duties:** 
    - `urllib.request`: Executing POST requests to the Ollama API and GET requests to web search engines and target URLs.
    - `urllib.parse`: URL-encoding search queries for DuckDuckGo.
    - `urllib.error`: Catching connection issues (e.g., if the Ollama server is not running).

### 3. `argparse`
- **Function:** Command-line option and argument parsing.
- **Reasoning:** Provides a professional CLI interface with built-in help and flexible input handling.
- **Imported at:** Line 6 (`import argparse`).
- **Duties:** 
    - Managing the primary `query` argument.
    - Implementing the `--interactive` or `-i` flag for persistent chat sessions.
    - Generating the help menu (`--help`).

### 4. `re` (Regular Expressions)
- **Function:** String pattern matching and manipulation.
- **Reasoning:** Used for surgical extraction of data from HTML when standard parsing is too heavy or when specific snippets (like search results) need to be isolated.
- **Imported at:** Line 8 (`import re`).
- **Duties:** 
    - Extracting search result snippets and URLs from DuckDuckGo's HTML response.
    - Stripping `<script>` and `<style>` blocks from fetched web content.
    - Normalizing whitespace in extracted text for better LLM readability.

### 5. `html.parser` (`HTMLParser`)
- **Function:** A simple HTML and XHTML parser.
- **Reasoning:** Replaces `beautifulsoup4` for converting HTML to plain text. It is lightweight and built directly into Python.
- **Imported at:** Line 9 (`from html.parser import HTMLParser`).
- **Duties:** 
    - Providing the base class for `MLStripper`, which extracts human-readable text from raw HTML tags.
    - Handling HTML entities (e.g., `&amp;` to `&`) automatically.

### 6. `sys`
- **Function:** System-specific parameters and functions.
- **Reasoning:** Standard for handling script exits and basic environment interaction.
- **Imported at:** Line 7 (`import sys`).
- **Duties:** 
    - Exiting the script with appropriate status codes if arguments are missing.
