# ETHUB CLI - Project Documentation (Gemini)

## Recent Changes (March 9, 2026)

### Asynchronous Refactoring of `ResearchEngine`
- **Asynchronous Operations**: Converted `core/research_engine.py` to use `asyncio` and `aiohttp` for non-blocking network and LLM requests.
- **Concurrent Processing**: Implemented `asyncio.gather` in `_perform_verified_search` to fetch and analyze multiple search results in parallel, significantly improving research speed.
- **Robust Parsing**: Integrated `BeautifulSoup` for HTML content extraction, replacing unreliable regex-based methods.
- **Session Management**: Implemented `aiohttp.ClientSession` management within the `ResearchEngine` class.

### Configuration Externalization
- **Granular Timeouts**: Added `llm_timeout`, `web_fetch_timeout`, and `search_request_timeout` to `core/config_engine.py` and its default configuration.
- **Configurable Ollama URL**: Updated `ResearchEngine` to retrieve the Ollama URL from `ConfigEngine` instead of using a hardcoded value.
- **Adaptability**: Modified `ResearchEngine` to use these new configuration settings for all network-bound operations.

### Performance & Optimization
- **Caching**: Implemented an in-memory cache for web content and LLM responses in `ResearchEngine` to accelerate repeated queries.
- **Removed Delays**: Eliminated hardcoded `time.sleep(2.0)` delays in the research process.

### User Interface Enhancements
- **Progress Feedback**: Enhanced the `research_topic` action handler in `ethub_cli.py` to provide clearer start and completion messages during deep research tasks.

## Maintenance Rules

1.  **Continuous Documentation**: All new code changes, refactorings, and feature implementations must be documented in this `Gemini.md` file immediately upon completion.
2.  **Asynchronous by Default**: For network-bound operations (web fetching, API calls), prioritize asynchronous and concurrent implementations (`asyncio`, `aiohttp`).
3.  **Externalize Settings**: Avoid hardcoding URLs, timeouts, or model names. Always use `ConfigEngine` to manage and retrieve configuration parameters.
4.  **Robust Content Parsing**: Use established libraries like `BeautifulSoup` for HTML parsing to ensure reliability and maintainability.
5.  **Utilize Caching**: Implement caching mechanisms for redundant or expensive operations (like LLM queries and web scraping) whenever feasible to optimize performance.
