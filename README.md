# ETHUB-CLI | Surgical Management Engine v2.1

**ETHUB-CLI** is a high-density, isolated, and verifiable autonomous agent for Termux/Linux environments. It specializes in surgical directory operations, automated system recovery, and professional technical debugging.

---

## 🏗️ Core Architecture (Surgical & Return)

ETHUB-CLI moves away from legacy metrics toward **Semantic Labels** and **Field Identifiers**, ensuring that every modification is isolated and verifiable.

### 1. [FIELD: SURGICAL_FIX]
- **Surgical Action Engine**: Every file modification includes a mandatory **SHA256 Integrity Check** and an automatic backup in `.ethub/snapshots/`.
- **Isolation**: Path-aware logic restricts all agent actions to the project root, preventing sensitive system file access.
- **Sanitization**: Thoroughly strips `<script>` and `<style>` tags to prevent malicious injection from web content.

### 2. [FIELD: RETURN_RECOVERY]
- **Unified Manifest**: Captures the entire agent state (history, memory, training) into point-in-time manifests.
- **Restore & Rollback**: Revert the entire system to a previous state or surgically rollback individual file fixes using the `.bak` system.

---

## 🛠️ Command Hierarchy

### Interactive CLI Commands
- `/return [list | <id>]` - Manage system restoration points.
- `/action [list | read <f> | patch <f> <c>]` - Manually execute surgical file operations.
- `/web [start | stop]` - Launch the **Surgical Management Dashboard** (Default: http://localhost:8080).
- `/settings` - View and update core engine parameters.
- `/search <query>` - Execute a manual, audited web search.

### Agent Workflow (Surgical Protocol)
When an error or code request is presented, the agent uses the **Strategic Formatting Hierarchy**:
- **REASON**: Technical "why" behind the error.
- **FIX_CMDS**: Exact shell instructions for resolution.
- **DIFF_PATCH**: Surgical code comparison using unified diff syntax.
- **AUDIT**: Security audit trail of the proposed fix.

---

## 🛡️ Security & Integrity

- **9-Point Audit**: Every proposed fix and fetched URL is audited by the `SafetyEngine` for risky patterns (e.g., `rm -rf /`, `/etc/passwd`).
- **Read-Before-Write**: Mandatory context gathering before any filesystem modification.
- **Zero-Corruption**: SHA256 verification ensures that the final file state matches the intended fix precisely.

---

## 🧬 Getting Started

```bash
# Clone the repository and initialize
git clone https://github.com/username/ethub-cli.git && cd ethub-cli
# Start the interactive engine
python3 ethub_cli.py --interactive
```

*For detailed engine breakdowns, see [docs/engines.md](docs/engines.md).*
*For technical implementation details, see [docs/documentation.txt](docs/documentation.txt).*
