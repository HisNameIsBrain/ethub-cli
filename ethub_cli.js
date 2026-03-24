#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const APP_NAME = 'ethub-cli-agent';
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const LOG_ROOT = path.join(process.cwd(), 'ethub_cli_session_logs');
const CHANGE_LOG_ROOT = path.join(process.cwd(), 'ethub_cli_change_logs');

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true, type: typeof value });
  }
}

function summarizeReasoning(input) {
  const raw = String(input || '').trim();
  const lowered = raw.toLowerCase();
  const keywords = raw
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .slice(0, 12);

  let intent = 'general_request';
  if (/error|syntax|stack|trace|bug|fix|crash/.test(lowered)) intent = 'debugging';
  else if (/how|what|why|explain|guide|tutorial/.test(lowered)) intent = 'information_lookup';
  else if (/build|create|make|implement|write/.test(lowered)) intent = 'implementation';

  let strategy = 'Use local conversation context then query Ollama for a grounded response.';
  if (intent === 'debugging') {
    strategy = 'Focus on likely fault points, propose checks, and request missing runtime details if needed.';
  }

  return {
    query: raw,
    intent,
    keywords,
    strategy,
    note: 'Detailed private chain-of-thought is not exposed; this is a concise decision summary.'
  };
}

class SessionLogger {
  constructor(rootDir) {
    ensureDir(rootDir);
    ensureDir(CHANGE_LOG_ROOT);
    this.rootDir = rootDir;
    this.sessionId = this.buildSessionId();
    this.sessionDir = path.join(this.rootDir, this.sessionId);
    ensureDir(this.sessionDir);

    this.eventsPath = path.join(this.sessionDir, 'events.jsonl');
    this.transcriptPath = path.join(this.sessionDir, 'transcript.md');
    this.statePath = path.join(this.sessionDir, 'state.jsonl');
    this.structuredPath = path.join(this.sessionDir, 'structured_history.jsonl');
    this.latestPath = path.join(this.rootDir, 'LATEST_SESSION.txt');
    this.changeLogPath = path.join(CHANGE_LOG_ROOT, `${this.sessionId}_changes.log`);

    this.counter = 0;
    fs.writeFileSync(this.latestPath, `${this.sessionId}\n`, 'utf8');
    fs.writeFileSync(
      this.transcriptPath,
      `# ETHUB CLI Session\n\n- session_id: ${this.sessionId}\n- started_at: ${nowIso()}\n- cwd: ${process.cwd()}\n- ollama_url: ${DEFAULT_OLLAMA_URL}\n- model_default: ${DEFAULT_MODEL}\n\n`,
      'utf8'
    );
    this.writeCodeSnapshot();

    this.writeEvent('session_start', {
      app: APP_NAME,
      started_at: nowIso(),
      session_dir: this.sessionDir,
      cwd: process.cwd(),
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      ollama_url: DEFAULT_OLLAMA_URL,
      model_default: DEFAULT_MODEL
    });
  }

  buildSessionId() {
    const d = new Date();
    const stamp = [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0'),
      '_',
      String(d.getUTCHours()).padStart(2, '0'),
      String(d.getUTCMinutes()).padStart(2, '0'),
      String(d.getUTCSeconds()).padStart(2, '0'),
      '_',
      String(d.getUTCMilliseconds()).padStart(3, '0')
    ].join('');
    return `session_${stamp}`;
  }

  writeEvent(type, payload) {
    this.counter += 1;
    const event = {
      index: this.counter,
      ts: nowIso(),
      type,
      payload
    };
    fs.appendFileSync(this.eventsPath, `${safeJson(event)}\n`, 'utf8');
  }

  writeTranscript(role, content) {
    const text = String(content || '').trimEnd();
    const block = `\n## ${role} @ ${nowIso()}\n\n${text}\n`;
    fs.appendFileSync(this.transcriptPath, block, 'utf8');
  }

  writeState(state) {
    fs.appendFileSync(this.statePath, `${safeJson(state)}\n`, 'utf8');
  }

  writeStructuredRecord(record) {
    fs.appendFileSync(this.structuredPath, `${safeJson(record)}\n`, 'utf8');
  }

  writeCodeSnapshot() {
    const sourcePath = path.resolve(__filename);
    let sourceText = '';
    try {
      sourceText = fs.readFileSync(sourcePath, 'utf8');
    } catch (error) {
      sourceText = `Unable to read source file: ${error && error.message ? error.message : String(error)}`;
    }

    const numbered = sourceText
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(4, '0')}: ${line}`)
      .join('\n');

    const header =
      `# ETHUB CLI Change Log\n` +
      `session_id: ${this.sessionId}\n` +
      `created_at: ${nowIso()}\n` +
      `source_file: ${sourcePath}\n` +
      `note: New file per session, append-only event/state logs enabled.\n\n` +
      `## Source Snapshot (Line Numbered)\n`;

    fs.writeFileSync(this.changeLogPath, `${header}${numbered}\n`, 'utf8');
  }
}

class EthubCliAgent {
  constructor() {
    this.logger = new SessionLogger(LOG_ROOT);
    this.model = DEFAULT_MODEL;
    this.ollamaUrl = DEFAULT_OLLAMA_URL;
    this.requireApproval = true;
    this.history = [];
    this.pendingAction = null;
    this.actionMeta = {};

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'ethub> '
    });

    this.logger.writeEvent('config', {
      require_approval: this.requireApproval,
      model: this.model,
      ollama_url: this.ollamaUrl,
      commands: ['/help', '/status', '/model <name>', '/approve on', '/yes', '/no', '/exit']
    });

    this.flushState();
  }

  flushState() {
    this.logger.writeState({
      ts: nowIso(),
      model: this.model,
      ollama_url: this.ollamaUrl,
      require_approval: this.requireApproval,
      history_count: this.history.length,
      pending_action: this.pendingAction
    });
  }

  start() {
    this.print('ETHUB CLI Agent started. Ollama only, no external dependencies.');
    this.print(`Session logs: ${this.logger.sessionDir}`);
    this.print('Type /help for commands.');
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = String(line || '').trim();
      this.logger.writeEvent('stdin', { raw: line, trimmed: input });

      if (!input) {
        this.rl.prompt();
        return;
      }

      try {
        if (input.startsWith('/')) {
          await this.handleCommand(input);
        } else {
          await this.handleUserPrompt(input);
        }
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        this.print(`Error: ${message}`);
        this.logger.writeEvent('runtime_error', { message, stack: error && error.stack ? error.stack : null });
      }

      this.flushState();
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.logger.writeEvent('session_end', { ended_at: nowIso() });
      process.stdout.write('\nSession closed.\n');
      process.exit(0);
    });
  }

  print(text) {
    process.stdout.write(`${text}\n`);
    this.logger.writeEvent('stdout', { text });
  }

  async handleCommand(input) {
    const [cmd, ...args] = input.split(/\s+/);
    const command = cmd.toLowerCase();
    this.logger.writeEvent('subcommand', { command, args });

    if (command === '/help') {
      this.print('Commands: /help, /status, /model <name>, /approve on, /yes, /no, /exit');
      return;
    }

    if (command === '/status') {
      this.print(safeJson({
        model: this.model,
        ollama_url: this.ollamaUrl,
        require_approval: this.requireApproval,
        history_count: this.history.length,
        pending_action: this.pendingAction ? this.pendingAction.id : null
      }));
      return;
    }

    if (command === '/model') {
      const nextModel = args.join(' ').trim();
      if (!nextModel) {
        this.print(`Current model: ${this.model}`);
        return;
      }
      this.model = nextModel;
      this.print(`Model updated: ${this.model}`);
      this.logger.writeEvent('config_update', { key: 'model', value: this.model });
      return;
    }

    if (command === '/approve') {
      const mode = (args[0] || '').toLowerCase();
      if (mode !== 'on') {
        this.print('Approval is mandatory. Use: /approve on');
        return;
      }
      this.requireApproval = true;
      this.print('Approval mode: on');
      this.logger.writeEvent('config_update', { key: 'require_approval', value: this.requireApproval });
      return;
    }

    if (command === '/yes') {
      if (!this.pendingAction) {
        this.print('No pending action to approve.');
        return;
      }
      const action = this.pendingAction;
      this.pendingAction = null;
      this.logger.writeEvent('approval', { action_id: action.id, approved: true });
      this.writeStructuredUpdate(action.id, {
        'Print-approved-by-user?': 'true',
        approved: true
      });
      await this.executeAction(action);
      return;
    }

    if (command === '/no') {
      if (!this.pendingAction) {
        this.print('No pending action to reject.');
        return;
      }
      const action = this.pendingAction;
      this.pendingAction = null;
      this.logger.writeEvent('approval', { action_id: action.id, approved: false });
      this.writeStructuredUpdate(action.id, {
        'Print-approved-by-user?': 'false',
        approved: false,
        summary: 'Action was rejected by user before runtime execution.',
        'Run runtime look at logs': 'skipped (approval rejected)'
      });
      this.print(`Action ${action.id} skipped.`);
      return;
    }

    if (command === '/exit') {
      this.rl.close();
      return;
    }

    this.print(`Unknown command: ${command}. Use /help.`);
  }

  async handleUserPrompt(input) {
    const reasoning = summarizeReasoning(input);
    const action = {
      id: `act_${Date.now()}`,
      type: 'ollama_chat',
      prompt: input,
      reasoning_summary: reasoning,
      created_at: nowIso()
    };

    this.logger.writeTranscript('User', input);
    this.logger.writeEvent('user_prompt', {
      text: input,
      reasoning_summary: reasoning,
      proposed_action: { id: action.id, type: action.type }
    });
    this.actionMeta[action.id] = {
      prompt: input,
      prompt_chars_before: input.length
    };

    this.logger.writeStructuredRecord({
      timestamp: nowIso(),
      query: input,
      reasoning: {
        query: reasoning.query,
        intent: reasoning.intent,
        keywords: reasoning.keywords,
        search_strategy: reasoning.strategy
      },
      actions: {
        action: 'local_ollama_request',
        sources: ['ollama_localhost'],
        Context: 'Analyzing locally via Ollama only; no OpenAI/Gemini/external model APIs.'
      },
      Commands: "ls, grep, nano, cd, nano 'create-new-file-diff-snippet-number+1.sh', regen entire file with changes then save, cp -rf old/path/to/file move/to/backup/path/file, rm old/path/to/file, bash create-new-file-(diff-snippet-line:character)-(number)+1, sed -i 's/old/new' \"$file\"",
      Diff: '+,-',
      Path: 'path/to/file:line:character',
      action_id: action.id,
      'Print-approved-by-user?': this.requireApproval ? 'pending' : 'true',
      'Run runtime look at logs': 'pending',
      summary: 'pending',
      'Number of characters changed': 'pending'
    });

    if (this.requireApproval) {
      this.pendingAction = action;
      this.print(`Pending action ${action.id}: send prompt to Ollama model '${this.model}'.`);
      this.print('Approve with /yes or reject with /no.');
      return;
    }

    await this.executeAction(action);
  }

  writeStructuredUpdate(actionId, patch) {
    this.logger.writeStructuredRecord({
      timestamp: nowIso(),
      action_id: actionId,
      update: patch
    });
  }

  async executeAction(action) {
    if (!action || action.type !== 'ollama_chat') {
      this.logger.writeEvent('action_error', { message: 'Unsupported action type', action });
      this.writeStructuredUpdate(action && action.id ? action.id : 'unknown', {
        'Run runtime look at logs': 'contains error still, unsupported action type',
        summary: 'Unsupported action type encountered before runtime request.',
        'Number of characters changed': 'previous character amount in file before cmd/new total character count added: 0/0'
      });
      this.print('Unsupported action.');
      return;
    }

    this.logger.writeEvent('action_start', {
      action_id: action.id,
      type: action.type,
      target: this.ollamaUrl,
      model: this.model,
      prompt_chars: action.prompt.length,
      reasoning_summary: action.reasoning_summary
    });

    this.history.push({ role: 'user', content: action.prompt });

    const payload = {
      model: this.model,
      messages: this.history,
      stream: false
    };

    let response;
    let raw;
    const started = Date.now();

    try {
      response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      raw = await response.text();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      this.logger.writeEvent('action_failure', {
        action_id: action.id,
        duration_ms: Date.now() - started,
        error: message
      });
      this.writeStructuredUpdate(action.id, {
        'Run runtime look at logs': 'contains error still, loop and try again with different results until each individual error is clear.',
        summary: `Runtime request failed. Error: ${message}`,
        'Number of characters changed': `previous character amount in file before cmd/new total character count added: ${action.prompt.length}/0`,
        'Print-approved-by-user?': 'true'
      });
      this.print(`Ollama request failed: ${message}`);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const assistantText = parsed && parsed.message && parsed.message.content
      ? String(parsed.message.content)
      : raw;

    this.history.push({ role: 'assistant', content: assistantText });

    this.logger.writeEvent('action_result', {
      action_id: action.id,
      duration_ms: Date.now() - started,
      http_status: response.status,
      ok: response.ok,
      response_preview: assistantText.slice(0, 400),
      response_chars: assistantText.length
    });

    this.logger.writeTranscript('Assistant', assistantText);
    this.print(assistantText);

    const hasRuntimeError = /(syntaxerror|stack overflow|runtime error|error:)/i.test(assistantText);
    const runtimeResult = hasRuntimeError
      ? 'contains error still, retry with different checks until isolated'
      : 'No runtime error anymore = fixed';
    const beforeChars = this.actionMeta[action.id] && this.actionMeta[action.id].prompt_chars_before
      ? this.actionMeta[action.id].prompt_chars_before
      : 0;
    const afterChars = assistantText.length;
    const elapsedMs = Date.now() - started;

    this.writeStructuredUpdate(action.id, {
      'Run runtime look at logs': runtimeResult,
      summary: `summarized what just changed, is it fixed: ${hasRuntimeError ? 'No' : 'Yes'}. Runtime error count estimate: ${hasRuntimeError ? 1 : 0}.`,
      'Number of characters changed': `previous character amount in file before cmd/new total character count added: ${beforeChars}/${afterChars}`,
      timing_ms: elapsedMs,
      stop_condition: elapsedMs >= 300000 ? 'Unable to find results or solutions, Try again.' : 'within loop budget'
    });
  }
}

const agent = new EthubCliAgent();
agent.start();
