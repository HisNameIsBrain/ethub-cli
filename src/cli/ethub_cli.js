#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const APP_NAME = 'ethub-cli-agent';
const APP_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const DEFAULT_MODEL = 'qwen2.5:0.5b';
const INITIAL_CWD = process.cwd();
const SKILLS_PATH = path.join(process.cwd(), 'ethub_cli_skills.json');
const ARTIFACTS_ROOT = path.join(process.cwd(), 'artifacts');
const WORKSPACE_WEB_DEBUG_DIR = path.join(INITIAL_CWD, 'web_debug');
const WEB_DEBUG_SERVER_PATH_LOCAL = path.join(WORKSPACE_WEB_DEBUG_DIR, 'index_server.mjs');
const WEB_DEBUG_SERVER_PATH_APP = path.join(APP_ROOT, 'web_debug', 'index_server.mjs');
const WEB_DEBUG_RUNTIME_PATH_LOCAL = path.join(WORKSPACE_WEB_DEBUG_DIR, 'runtime.json');
const WEB_DEBUG_RUNTIME_PATH_APP = path.join(APP_ROOT, 'web_debug', 'runtime.json');
const MAX_SKILL_SNIPPET_CHARS = 12000;
const MAX_SKILL_CANDIDATES = 100;
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024;
const SAFE_SKILL_COMMANDS = new Set([
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'wc',
  'rg',
  'grep',
  'find',
  'sed',
  'cp',
  'mv',
  'mkdir',
  'touch',
  'echo',
  'sort',
  'uniq',
  'cut',
  'diff',
  'unzip',
  'zip',
  'tar',
  'git'
]);
const TEXT_EXTENSIONS = new Set([
  '.json',
  '.md',
  '.txt',
  '.sh',
  '.bash',
  '.zsh',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.html',
  '.css',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.cfg',
  '.sql'
]);
const BLOCKED_COMMAND_PATTERN = /[`|&;<>]/;
const ETHUB_ASCII = [
  "oooooooooooo ooooooooooooo ooooo   ooooo ooooo     ooo oooooooooo.",
  "`888'     `8 8'   888   `8 `888'   `888' `888'     `8' `888'   `Y8b",
  " 888              888       888     888   888       8   888     888",
  " 888oooo8         888       888ooooo888   888       8   888oooo888'",
  " 888              888       888     888   888       8   888    `88b",
  " 888       o      888       888     888   `88.    .8'   888    .88P",
  "o888ooooood8     o888o     o888o   o888o    `YbodP'    o888bood8P'"
];
const DIVIDER_CHARS = ['-', '=', '~', '-'];
const SUGGESTIONS = [
  'Summarize the last answer in 3 bullets.',
  'Review this shell command for safety.',
  'Draft a concise changelog entry.'
];
const LEFT_PAD = '  ';
const HEADER_WIDTH = 76;
const MAX_READFILE_BYTES = 64 * 1024;
const ANSI_ENABLED = true;
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};
const DEBUG_PANEL_WIDTH = 90;
const DEBUG_HORIZONTAL = '─';
const TASK_REGISTRY_WIDTH = 90;
const FOOTER_WIDTH = 90;
const QUEUE_PAGE_SIZE = 5;

function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function visibleLength(text) {
  return stripAnsi(text).length;
}

function seedTaskRegistry() {
  return [
    { id: 'boot', label: 'boot/session', state: 'done', detail: 'logger + prompt ready' },
    { id: 'plan', label: 'plan/idle', state: 'idle', detail: 'awaiting prompt' },
    { id: 'worker', label: 'worker/ollama', state: 'idle', detail: 'no active request' },
    { id: 'io', label: 'helpers/filesystem', state: 'idle', detail: 'no pending actions' }
  ];
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

function updateTaskRegistry(taskRegistry, taskId, patch) {
  const next = Array.isArray(taskRegistry) ? taskRegistry.slice() : [];
  const idx = next.findIndex((task) => task.id === taskId);
  if (idx === -1) {
    next.push({ id: taskId, label: taskId, state: 'idle', detail: '', ...(patch || {}) });
    return next;
  }
  next[idx] = { ...next[idx], ...(patch || {}) };
  return next;
}

function taskIcon(state) {
  if (state === 'done') return style('■■', ANSI.cyan);
  if (state === 'active') return style('▓▓', ANSI.yellow);
  if (state === 'error') return style('██', ANSI.red);
  if (state === 'pending') return style('▒▒', ANSI.magenta);
  return style('··', ANSI.dim);
}

function formatTaskLine(task) {
  const state = String(task && task.state ? task.state : 'idle');
  const label = String(task && task.label ? task.label : 'task');
  const detail = String(task && task.detail ? task.detail : '');
  return `${taskIcon(state)} ${label} :: ${detail}`;
}

function formatFooterSegment(label, value, tone = ANSI.dim) {
  return style(`${label} ${value}`, tone);
}

function formatChangeCount(additions, deletions) {
  const parts = [];
  if (Number.isFinite(additions) && additions > 0) parts.push(`+${additions}`);
  if (Number.isFinite(deletions) && deletions > 0) parts.push(`-${deletions}`);
  return parts.length ? parts.join('/') : 'delta n/a';
}

function summarizeWorktreeState(code) {
  if (code === '??') return 'new file';
  if (code === '!!') return 'ignored';
  if (code.includes('D')) return 'deleted';
  if (code.includes('R')) return 'renamed';
  if (code.includes('A')) return 'added';
  if (code.includes('U')) return 'conflict';
  if (code.includes('M')) return 'modified';
  return 'changed';
}

function trimLeadingWhitespace(text) {
  let index = 0;
  const source = String(text || '');
  while (index < source.length) {
    const ch = source[index];
    if (ch !== ' ' && ch !== '\t') break;
    index += 1;
  }
  return source.slice(index);
}

function style(text, ...codes) {
  if (!ANSI_ENABLED || !codes.length) return String(text);
  return `${codes.join('')}${text}${ANSI.reset}`;
}

function rgb(text, r, g, b) {
  if (!ANSI_ENABLED) return String(text);
  return `\x1b[38;2;${r};${g};${b}m${text}${ANSI.reset}`;
}

function hslToRgb(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(c * 255);
  };
  return { r: f(0), g: f(8), b: f(4) };
}

function rainbowDivider(width, phase) {
  let out = '';
  for (let i = 0; i < width; i += 1) {
    const ch = DIVIDER_CHARS[i % DIVIDER_CHARS.length];
    const p = (i / width + phase) % 1;
    const { r, g, b } = hslToRgb(p * 360, 0.6, 0.65);
    out += rgb(ch, r, g, b);
  }
  return out;
}

function rainbowAsciiLine(line, row, totalRows, frame) {
  let out = '';
  const len = Math.max(line.length, 1);

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === ' ') {
      out += ' ';
      continue;
    }

    const phase = (i / len + row / totalRows + frame * 0.01) % 1;
    const { r, g, b } = hslToRgb(phase * 360, 0.6, 0.65);

    let display = ch;
    if ((ch === 'o' || ch === '8') && (frame + i + row) % 47 === 0) {
      display = '+';
    }

    out += rgb(display, r, g, b);
  }

  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function truncateText(input, maxLen) {
  const text = String(input || '');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n...[truncated]`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true, type: typeof value });
  }
}

function isLikelyTextPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const base = path.basename(filePath).toLowerCase();
  if (base.startsWith('conversations-') && base.endsWith('.json')) return true;
  if (base === 'chat.html' || base === 'export_manifest.json') return true;
  return false;
}

function normalizeSnippet(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function looksLikeUsefulSnippet(snippet) {
  const s = normalizeSnippet(snippet);
  if (!s || s.length < 8) return false;
  const lowered = s.toLowerCase();
  if (lowered.includes('user profile is shown') || lowered.includes('before answering, quietly think')) return false;
  if (s.length > MAX_SKILL_SNIPPET_CHARS) return false;
  if (/^(ls|pwd|cat|head|tail|wc|rg|grep|find|sed|cp|mv|mkdir|touch|echo|git)\b/.test(s)) return true;
  if (/[{};$]|=>|function\s|\bconst\s|\blet\s|\bclass\s|\bimport\s|\bexport\s|#!/.test(s)) return true;
  if (/<[a-zA-Z][^>]*>[\s\S]*<\/[a-zA-Z]+>/.test(s)) return true;
  return false;
}

function tokenizeCommandLine(input) {
  const text = String(input || '');
  const tokens = [];
  let current = '';
  let quote = null;
  let escaping = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (escaping) return { error: 'Command cannot end with a trailing escape.' };
  if (quote) return { error: 'Unclosed quote in command.' };
  if (current) tokens.push(current);
  return { tokens };
}

function isPathInsideRoot(workspaceRoot, candidatePath) {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(candidatePath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

function extractTextEntriesFromZip(zipPath, shouldInclude) {
  const out = [];
  const data = fs.readFileSync(zipPath);
  const minEocd = 22;
  const maxComment = 0xffff;
  const startSearch = Math.max(0, data.length - (minEocd + maxComment));
  let eocd = -1;
  for (let i = data.length - minEocd; i >= startSearch; i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip EOCD signature not found');

  const centralDirSize = data.readUInt32LE(eocd + 12);
  const centralDirOffset = data.readUInt32LE(eocd + 16);
  const centralDirEnd = centralDirOffset + centralDirSize;
  let cursor = centralDirOffset;

  while (cursor + 46 <= centralDirEnd && cursor + 46 <= data.length) {
    const sig = data.readUInt32LE(cursor);
    if (sig !== 0x02014b50) break;
    const compressionMethod = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const fileNameLen = data.readUInt16LE(cursor + 28);
    const extraLen = data.readUInt16LE(cursor + 30);
    const commentLen = data.readUInt16LE(cursor + 32);
    const localHeaderOffset = data.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLen;
    const entryName = data.slice(nameStart, nameEnd).toString('utf8');
    const next = nameEnd + extraLen + commentLen;
    cursor = next;

    if (!shouldInclude(entryName)) continue;
    if (entryName.endsWith('/')) continue;
    if (localHeaderOffset + 30 > data.length) continue;
    if (data.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = data.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = data.readUInt16LE(localHeaderOffset + 28);
    const payloadStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const payloadEnd = payloadStart + compressedSize;
    if (payloadEnd > data.length) continue;

    const compressed = data.slice(payloadStart, payloadEnd);
    let decoded;
    if (compressionMethod === 0) {
      decoded = compressed;
    } else if (compressionMethod === 8) {
      decoded = zlib.inflateRawSync(compressed);
    } else {
      continue;
    }

    out.push({
      entry: entryName,
      text: decoded.toString('utf8')
    });
  }
  return out;
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

class EthubCliAgent {
  constructor() {
    this.workspaceRoot = INITIAL_CWD;
    this.model = DEFAULT_MODEL;
    this.ollamaUrl = DEFAULT_OLLAMA_URL;
    this.skillsPath = SKILLS_PATH;
    this.requireApproval = false;
    this.history = [];
    this.pendingAction = null;
    this.pendingActionPrompt = '';
    this.pendingActions = [];
    this.actionDrainActive = false;
    this.actionMeta = {};
    this.skillCandidates = [];
    this.skills = this.loadSkills();
    this.dashboardInfo = null;
    this.debugServerProcess = null;
    this.debugServerToken = '';
    this.thinkingTimer = null;
    this.isClosed = false;
    this.loopState = 'idle';
    this.activeLane = 'general';
    this.activePrompt = '';
    this.taskRegistry = [];
    this.promptTokensEst = 0;
    this.completionTokensEst = 0;
    this.totalCostEst = 0;
    this.lastLatencyMs = 0;
    this.actionsRun = 0;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: style('ethub> ', ANSI.bold, ANSI.cyan)
    });
    this.refreshPrompt();

    this.taskRegistry = seedTaskRegistry();
  }

  updateTask(taskId, patch) {
    this.taskRegistry = updateTaskRegistry(this.taskRegistry, taskId, patch);
  }

  loadSkills() {
    if (!fs.existsSync(this.skillsPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.skillsPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.skills)) return [];
      return parsed.skills
        .filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.name === 'string')
        .map((s) => ({
          id: s.id,
          name: s.name,
          snippet: String(s.snippet || ''),
          source: String(s.source || 'manual'),
          executable: Boolean(s.executable),
          created_at: String(s.created_at || nowIso())
        }));
    } catch (error) {
      return [];
    }
  }

  saveSkills() {
    const payload = {
      updated_at: nowIso(),
      skills: this.skills
    };
    fs.writeFileSync(this.skillsPath, `${safeJson(payload)}\n`, 'utf8');
  }

  extractSnippetCandidatesFromText(text, sourceLabel, addCandidate) {
    const raw = String(text || '');
    const segments = [];
    let parsed = null;

    if (/^\s*[\[{]/.test(raw)) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    const walk = (value, depth = 0) => {
      if (depth > 8) return;
      if (typeof value === 'string') {
        if (value.trim()) segments.push(value);
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
        return;
      }
      if (value.content && Array.isArray(value.content.parts)) {
        for (const part of value.content.parts) {
          if (typeof part === 'string' && part.trim()) segments.push(part);
        }
      }
      if (typeof value.text === 'string' && value.text.trim()) {
        segments.push(value.text);
      }
      for (const key of Object.keys(value)) {
        if (key === 'content' || key === 'text') continue;
        walk(value[key], depth + 1);
      }
    };

    if (parsed) {
      walk(parsed);
    } else {
      segments.push(raw);
    }

    for (const segment of segments) {
      const fencePattern = /```(?:[^\n`]*)\n([\s\S]*?)```/g;
      let match;
      while ((match = fencePattern.exec(segment)) !== null) {
        addCandidate(match[1], sourceLabel, 'fenced_code');
      }

      const lines = segment.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length > 220) continue;
        const shellLike = trimmed.replace(/^\$\s*/, '');
        if (/^(ls|pwd|cat|head|tail|wc|rg|grep|find|sed|cp|mv|mkdir|touch|echo|git)\b/.test(shellLike)) {
          addCandidate(shellLike, sourceLabel, 'shell_line');
        }
      }
    }
  }

  listArtifactZipFiles() {
    const out = [];
    if (!fs.existsSync(ARTIFACTS_ROOT)) return out;
    const stack = [ARTIFACTS_ROOT];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && full.toLowerCase().endsWith('.zip')) {
          out.push(full);
        }
      }
    }
    return out;
  }

  collectSkillCandidatesFromArtifacts(limit = 10) {
    const snippets = new Map();
    let scannedSources = 0;
    const cap = Math.max(1, Math.min(MAX_SKILL_CANDIDATES, Number(limit) || 10));
    const addCandidate = (snippetText, sourceLabel, sourceKind) => {
      const normalized = normalizeSnippet(snippetText);
      if (!looksLikeUsefulSnippet(normalized)) return;
      const existing = snippets.get(normalized);
      if (existing) {
        existing.hits += 1;
        existing.sources.add(sourceLabel);
        return;
      }
      snippets.set(normalized, {
        snippet: normalized,
        hits: 1,
        source_kind: sourceKind,
        sources: new Set([sourceLabel])
      });
    };

    const zipFiles = this.listArtifactZipFiles();
    for (const zipPath of zipFiles) {
      try {
        const entries = extractTextEntriesFromZip(zipPath, isLikelyTextPath);
        for (const item of entries) {
          scannedSources += 1;
          this.extractSnippetCandidatesFromText(item.text, `${path.basename(zipPath)}:${item.entry}`, addCandidate);
        }
      } catch (error) {
        void error;
      }
    }

    const directArtifactFiles = [];
    if (fs.existsSync(ARTIFACTS_ROOT)) {
      const stack = [ARTIFACTS_ROOT];
      while (stack.length) {
        const current = stack.pop();
        let entries = [];
        try {
          entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) stack.push(full);
          else if (entry.isFile() && !full.toLowerCase().endsWith('.zip') && isLikelyTextPath(full)) directArtifactFiles.push(full);
        }
      }
    }

    for (const filePath of directArtifactFiles) {
      let text = '';
      try {
        text = fs.readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }
      scannedSources += 1;
      this.extractSnippetCandidatesFromText(text, this.workspaceRelativePath(filePath), addCandidate);
    }

    const ranked = Array.from(snippets.values())
      .sort((a, b) => b.hits - a.hits || b.snippet.length - a.snippet.length)
      .slice(0, cap);

    this.skillCandidates = ranked.map((entry, idx) => {
      const snippet = entry.snippet;
      const safety = this.validateSkillCommand(snippet);
      return {
        id: `cand_${idx + 1}`,
        snippet,
        hits: entry.hits,
        source_kind: entry.source_kind,
        sources: Array.from(entry.sources).slice(0, 6),
        executable: safety.ok,
        safety_reason: safety.ok ? '' : safety.reason
      };
    });

    return {
      candidates: this.skillCandidates.length,
      uniqueSnippets: snippets.size,
      scannedSources,
      zipFiles: zipFiles.length
    };
  }

  findCandidate(query) {
    const q = String(query || '').trim();
    if (!q) return null;
    return this.skillCandidates.find((c) => c.id === q) || null;
  }

  findSkill(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    return this.skills.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q) || null;
  }

  validatePathToken(token) {
    const raw = String(token || '').trim();
    if (!raw) return { ok: true };
    if (raw === '-' || raw.startsWith('-')) return { ok: true };
    if (raw.startsWith('/')) return { ok: false, reason: `Absolute paths are blocked (${raw}).` };
    if (raw.includes('..')) return { ok: false, reason: `Parent traversal is blocked (${raw}).` };
    const resolved = path.resolve(process.cwd(), raw);
    if (!isPathInsideRoot(this.workspaceRoot, resolved)) {
      return { ok: false, reason: `Path escapes workspace root (${raw}).` };
    }
    return { ok: true };
  }

  validateSkillCommand(snippet) {
    const commandText = normalizeSnippet(snippet);
    if (!commandText) return { ok: false, reason: 'Empty snippet.' };
    const lines = commandText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length !== 1) return { ok: false, reason: 'Only single-line shell skills are executable.' };
    const line = lines[0];
    if (BLOCKED_COMMAND_PATTERN.test(line)) {
      return { ok: false, reason: 'Command contains blocked shell operators.' };
    }

    const parsed = tokenizeCommandLine(line);
    if (parsed.error) return { ok: false, reason: parsed.error };
    const tokens = parsed.tokens || [];
    if (!tokens.length) return { ok: false, reason: 'No command token found.' };

    const cmd = tokens[0];
    if (!SAFE_SKILL_COMMANDS.has(cmd)) {
      return { ok: false, reason: `Command '${cmd}' is not allowlisted.` };
    }
    if (cmd === 'git') {
      const sub = (tokens[1] || '').toLowerCase();
      if (!['status', 'diff', 'log', 'show', 'branch', 'rev-parse'].includes(sub)) {
        return { ok: false, reason: `git '${sub || '(none)'}' is blocked.` };
      }
    }

    for (let i = 1; i < tokens.length; i += 1) {
      const pathCheck = this.validatePathToken(tokens[i]);
      if (!pathCheck.ok) return pathCheck;
    }
    return { ok: true, command: cmd, tokens };
  }

  async runSkillCommand(action) {
    const payload = action && action.payload ? action.payload : {};
    const skillName = payload.skill_name || payload.skill_id || 'unknown';
    const snippet = String(payload.snippet || '');
    const validation = this.validateSkillCommand(snippet);
    if (!validation.ok) {
      this.print(`${style('Skill execution denied:', ANSI.bold, ANSI.red)} ${validation.reason}`);
      return;
    }

    const tokens = validation.tokens;
    const cmd = tokens[0];
    const args = tokens.slice(1);
    this.loopState = 'running';
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: 'active',
      detail: `skill ${skillName}`
    });
    this.print(style(`[SKILL RUN] ${skillName}: ${snippet}`, ANSI.bold, ANSI.cyan));

    const result = await new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });

      let stdout = '';
      let stderr = '';
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        child.kill('SIGTERM');
      }, 120000);

      child.stdout.on('data', (chunk) => {
        if (stdout.length >= MAX_COMMAND_OUTPUT_BYTES) return;
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        if (stderr.length >= MAX_COMMAND_OUTPUT_BYTES) return;
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        finished = true;
        resolve({ code: -1, signal: null, stdout, stderr: `${stderr}\n${error.message}`.trim() });
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        finished = true;
        resolve({ code, signal, stdout, stderr });
      });
    });

    if (result.stdout) {
      this.print(style('[STDOUT]', ANSI.dim));
      this.print(truncateText(result.stdout, MAX_COMMAND_OUTPUT_BYTES));
    }
    if (result.stderr) {
      this.print(style('[STDERR]', ANSI.dim));
      this.print(truncateText(result.stderr, MAX_COMMAND_OUTPUT_BYTES));
    }
    this.print(style(`[SKILL EXIT] code=${result.code} signal=${result.signal || 'none'}`, ANSI.dim));
    this.loopState = result.code === 0 ? 'idle' : 'error';
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: result.code === 0 ? 'done' : 'error',
      detail: `${skillName} exit=${result.code}`
    });
  }

  readDashboardRuntime() {
    const runtimePaths = [WEB_DEBUG_RUNTIME_PATH_LOCAL, WEB_DEBUG_RUNTIME_PATH_APP];
    for (const runtimePath of runtimePaths) {
      if (!fs.existsSync(runtimePath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
        if (!parsed || !parsed.port) continue;
        return parsed;
      } catch {
        // try next runtime path
      }
    }
    return null;
  }

  resolveDashboardServerPath() {
    if (fs.existsSync(WEB_DEBUG_SERVER_PATH_LOCAL)) return WEB_DEBUG_SERVER_PATH_LOCAL;
    if (fs.existsSync(WEB_DEBUG_SERVER_PATH_APP)) return WEB_DEBUG_SERVER_PATH_APP;
    return '';
  }

  async isDashboardHealthy(port) {
    const target = `http://127.0.0.1:${port}/api/health`;
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(900) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async ensureDashboardRunning() {
    const runtime = this.readDashboardRuntime();
    if (runtime && Number(runtime.port) > 0) {
      const healthy = await this.isDashboardHealthy(runtime.port);
      if (healthy) {
        this.dashboardInfo = runtime;
        return;
      }
    }

    const serverPath = this.resolveDashboardServerPath();
    if (!serverPath) return;
    try {
      const child = spawn(process.execPath, [serverPath], {
        cwd: this.workspaceRoot,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
    } catch (error) {
      return;
    }

    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const nextRuntime = this.readDashboardRuntime();
      if (nextRuntime && Number(nextRuntime.port) > 0) {
        this.dashboardInfo = nextRuntime;
        break;
      }
    }
  }

  async start() {
    if (ANSI_ENABLED) {
      await this.animateHeader(1200, 20);
    } else {
      this.drawHeader(0);
    }
    this.print(style('ETHUB CLI Agent started. Ollama only, no external dependencies.', ANSI.bold, ANSI.cyan));
    this.print(style('Use /debug to launch a session-bound web dashboard + chat.', ANSI.dim));
    this.print(style('Type /help for commands.', ANSI.yellow));
    await this.showSuggestions();
    this.printFooter();
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const rawInput = String(line || '');
      const input = rawInput.trim();

      if (!input) {
        this.printFooter();
        this.rl.prompt();
        return;
      }

      try {
        if (input.startsWith('/')) {
          await this.handleCommand(rawInput);
        } else {
          await this.handleUserPrompt(input);
        }
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        this.print(`${style('Error:', ANSI.bold, ANSI.red)} ${message}`);
      }

      this.printFooter();
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.isClosed = true;
      this.stopDebugDashboard();
      process.stdout.write('\nSession closed.\n');
      process.exit(0);
    });
  }

  stopDebugDashboard() {
    if (!this.debugServerProcess || this.debugServerProcess.killed) return;
    try {
      this.debugServerProcess.kill('SIGTERM');
    } catch {
      // best effort shutdown
    }
  }

  async startDebugDashboard() {
    if (this.debugServerProcess && !this.debugServerProcess.killed && this.dashboardInfo) {
      return this.dashboardInfo;
    }

    const serverPath = this.resolveDashboardServerPath();
    if (!serverPath) {
      throw new Error('web_debug/index_server.mjs not found');
    }

      const child = spawn(process.execPath, [serverPath], {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

    this.debugServerProcess = child;
    this.debugServerToken = '';
    let startupOutput = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      startupOutput += text;
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      startupOutput += text;
    });
    child.on('exit', (code, signal) => {
      this.debugServerProcess = null;
      this.dashboardInfo = null;
      this.debugServerToken = '';
    });

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const urlMatch = startupOutput.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([a-f0-9]+)/i);
      if (urlMatch) {
        const port = Number(urlMatch[1]);
        const token = String(urlMatch[2] || '');
        const base = `http://127.0.0.1:${port}`;
        this.debugServerToken = token;
        this.dashboardInfo = {
          pid: child.pid,
          host: '127.0.0.1',
          port,
          dashboard_url: `${base}/?token=${token}`,
          chat_url: `${base}/chat?token=${token}`
        };
        return this.dashboardInfo;
      }

      const runtime = this.readDashboardRuntime();
      if (runtime && Number(runtime.port) > 0) {
        const healthy = await this.isDashboardHealthy(runtime.port);
        if (healthy && this.debugServerToken) {
          const base = `http://127.0.0.1:${runtime.port}`;
          this.dashboardInfo = {
            ...runtime,
            dashboard_url: `${base}/?token=${this.debugServerToken}`,
            chat_url: `${base}/chat?token=${this.debugServerToken}`
          };
          return this.dashboardInfo;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    this.stopDebugDashboard();
    throw new Error('debug dashboard failed to start in time');
  }

  determineIntentWithHopper(input) {
    const reasoning = summarizeReasoning(input);
    const intent = String(reasoning.intent || 'general_request');
    let lane = 'general';
    if (intent === 'debugging') lane = 'debug';
    else if (intent === 'implementation' || intent === 'refactor') lane = 'code';
    else if (intent === 'shell_operation') lane = 'shell';
    else if (intent === 'planning') lane = 'plan';
    else if (intent === 'information_lookup' || intent === 'documentation') lane = 'research';
    else if (intent === 'testing') lane = 'verify';
    return { ...reasoning, hopper_lane: lane };
  }

  print(text) {
    process.stdout.write(`${text}\n`);
  }

  padLineForBox(text, width) {
    const base = String(text || '');
    const len = visibleLength(base);
    if (len >= width) return stripAnsi(base).slice(0, width);
    return base + ' '.repeat(width - len);
  }

  buildBox(title, rows, width = DEBUG_PANEL_WIDTH) {
    const prefix = `┌─ ${title} `;
    const fillerCount = Math.max(0, width - prefix.length - 1);
    const top = `${prefix}${DEBUG_HORIZONTAL.repeat(fillerCount)}┐`;
    const bottom = `└${DEBUG_HORIZONTAL.repeat(width - 2)}┘`;
    const innerWidth = width - 4;
    const body = rows.map((row) => `│ ${this.padLineForBox(row, innerWidth)} │`);
    return [top, ...body, bottom].join('\n');
  }

  renderTaskRegistryBox() {
    const baseRows = this.taskRegistry.map(formatTaskLine);
    const changeRows = this.collectUncommittedChangeRows();
    return this.buildBox('Task Registry', [...baseRows, ...changeRows], TASK_REGISTRY_WIDTH);
  }

  renderDebugDashboard(reasoning, context = {}) {
    const width = DEBUG_PANEL_WIDTH;
    const horizontal = DEBUG_HORIZONTAL.repeat(width);
    const header = 'Agent v3.1 - Local Debug Shell';
    const hasError = Boolean(context.error) || /error|crash|exception/i.test(reasoning.intent || '');
    const liveLines = [
      `INFO  cwd=${context.cwd || process.cwd()}`,
      `INFO  target=${context.target || './src'}`,
      `INFO  model=${this.model}`,
      `ERROR ${context.error || (hasError ? "TypeError: Cannot read property 'foo' of undefined" : 'no faults detected')}`,
      '',
      `ctx.intent=${context.intent || reasoning.intent || 'unknown'}`,
      `ctx.signal=${context.signal || (hasError ? 'runtime_exception' : 'idle')}`
    ];
    const debugLines = [
      `step=${context.step || 'analyze_error'}`,
      `input="${context.input || 'ethub fix ./src --auto-apply'}"`,
      '',
      'reasoning:',
      `• classified → ${reasoning.intent || 'general_request'}`,
      `• detected → ${context.detected || 'undefined property access'}`,
      `• mapped → ${context.mapped || 'src/index.js:42'}`,
      '',
      `next=${context.next || 'generate_fix'}`
    ];
    const planTasks = context.plan || [
      { label: 'scan_directory', done: true },
      { label: 'extract_stack', done: true },
      { label: 'map_error_to_ast', done: true },
      { label: 'generate_patch', done: false }
    ];
    const planLines = planTasks.map((task) => `${task.done ? '✔' : '⏳'} ${task.label}`);
    planLines.push('');
    planLines.push(`ctx.strategy=${context.strategy || reasoning.strategy || 'optional_chaining'}`);
    planLines.push(`ctx.target=${context.targetExpression || context.target || 'data.foo'}`);

    const statusLine = `ollama > ${context.commandLabel || 'generating fix'} (strategy=${context.strategy || reasoning.strategy || 'optional_chaining'})`;
    const modelStatus = `MODEL: ${this.model} | STATUS: ${context.status || (hasError ? 'generating_fix' : 'idle')} | TASK: ${context.task || 'src/index.js'}`;

    const layout = [
      header,
      horizontal,
      '',
      this.buildBox('Live Dashboard', liveLines),
      '',
      this.buildBox('Debug Loop', debugLines),
      '',
      this.buildBox('TODO Plan', planLines),
      '',
      horizontal,
      statusLine,
      '',
      horizontal,
      modelStatus
    ].join('\n');

    process.stdout.write('\x1b[2J\x1b[H');
    process.stdout.write(`${layout}\n`);
  }

  async showReasoningFlow(reasoning, prompt) {
    this.renderDebugDashboard(reasoning, { input: prompt });
  }

  workspaceRelativePath(targetPath = process.cwd()) {
    const rel = path.relative(this.workspaceRoot, targetPath);
    if (!rel || rel === '') return '.';
    if (rel.startsWith('..')) return targetPath;
    return rel;
  }

  refreshPrompt() {
    const rel = this.workspaceRelativePath();
    this.rl.setPrompt(style(`ethub:${rel}> `, ANSI.bold, ANSI.cyan));
  }

  runGitCommand(args) {
    try {
      return execFileSync('git', args, {
        cwd: this.workspaceRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
    } catch {
      return '';
    }
  }

  collectUncommittedChangeRows() {
    const statusOutput = this.runGitCommand(['status', '--short', '--untracked-files=all']);
    if (!statusOutput.trim()) {
      return [
        formatTaskLine({
          state: 'done',
          label: 'queue/uncommitted',
          detail: 'worktree clean'
        })
      ];
    }

    const numstatOutput = this.runGitCommand(['diff', '--numstat']);
    const numstatMap = new Map();
    for (const line of numstatOutput.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('\t');
      if (parts.length < 3) continue;
      const additions = Number(parts[0]);
      const deletions = Number(parts[1]);
      const filePath = parts.slice(2).join('\t');
      numstatMap.set(filePath, {
        additions: Number.isFinite(additions) ? additions : 0,
        deletions: Number.isFinite(deletions) ? deletions : 0
      });
    }

    const queueItems = [];
    for (const rawLine of statusOutput.split('\n')) {
      if (!rawLine.trim()) continue;
      const code = rawLine.slice(0, 2);
      const stagedCode = code[0];
      const unstagedCode = code[1];
      const include = code === '??' || unstagedCode !== ' ' || stagedCode === 'U' || unstagedCode === 'U';
      if (!include) continue;

      const filePath = rawLine.slice(3).trim();
      const stat = numstatMap.get(filePath);
      const delta = stat ? formatChangeCount(stat.additions, stat.deletions) : summarizeWorktreeState(code);
      queueItems.push({
        label: `queue/${String(queueItems.length + 1).padStart(2, '0')}`,
        detail: `${filePath} :: ${delta}`,
        state: code === '??' ? 'pending' : 'active'
      });
    }

    const totalPages = Math.max(1, Math.ceil(queueItems.length / QUEUE_PAGE_SIZE));
    const pageItems = queueItems.slice(0, QUEUE_PAGE_SIZE);
    const summaryDetail = queueItems.length === 1 ? '1 unstaged item' : `${queueItems.length} unstaged items`;
    const rows = [
      formatTaskLine({
        state: queueItems.length ? 'pending' : 'done',
        label: 'queue/uncommitted',
        detail: queueItems.length ? `${summaryDetail} | page 1/${totalPages}` : summaryDetail
      })
    ];

    for (const item of pageItems) {
      rows.push(formatTaskLine(item));
    }

    if (queueItems.length > pageItems.length) {
      rows.push(formatTaskLine({
        state: 'idle',
        label: 'queue/more',
        detail: `${queueItems.length - pageItems.length} more items on later pages`
      }));
    }

    return rows;
  }

  renderStatusFooter() {
    const cwdDisplay = this.workspaceRelativePath();
    const pendingCount = this.pendingActions.length + (this.pendingAction ? 1 : 0);
    const pendingLabel = this.pendingAction
      ? `${this.pendingAction.type}${pendingCount > 1 ? ` +${pendingCount - 1}` : ''}`
      : pendingCount
        ? `${pendingCount} queued`
        : 'none';
    const footerTop = [
      formatFooterSegment('MODEL', this.model, ANSI.cyan),
      formatFooterSegment('LANE', this.activeLane, ANSI.yellow),
      formatFooterSegment('LOOP', this.loopState, this.loopState === 'error' ? ANSI.red : ANSI.dim),
      formatFooterSegment('PENDING', pendingLabel, this.pendingAction ? ANSI.yellow : ANSI.dim)
    ].join(' | ');
    const footerBottom = [
      formatFooterSegment('PROMPT_TOK', this.promptTokensEst, ANSI.dim),
      formatFooterSegment('COMP_TOK', this.completionTokensEst, ANSI.dim),
      formatFooterSegment('COST_EST', `$${this.totalCostEst.toFixed(4)}`, ANSI.dim),
      formatFooterSegment('LATENCY', `${this.lastLatencyMs}ms`, ANSI.dim),
      formatFooterSegment('ACTIONS', this.actionsRun, ANSI.dim),
      formatFooterSegment('CWD', cwdDisplay, ANSI.dim)
    ].join(' | ');
    return this.buildBox('Status Footer', [footerTop, footerBottom], FOOTER_WIDTH);
  }

  printFooter() {
    this.print('');
    this.print(this.renderTaskRegistryBox());
    this.print(this.renderStatusFooter());
  }

  resolvePathInWorkspace(inputPath, expected = 'any') {
    const raw = String(inputPath || '').trim();
    if (!raw) return { error: 'path is required' };
    const normalized = raw === '~' ? os.homedir() : raw;
    const resolved = path.resolve(process.cwd(), normalized);
    const root = path.resolve(this.workspaceRoot);
    const inRoot = resolved === root || resolved.startsWith(`${root}${path.sep}`);
    if (!inRoot) {
      return { error: `path escapes workspace root: ${root}` };
    }

    if (expected === 'exists') {
      if (!fs.existsSync(resolved)) return { error: 'path does not exist' };
    }
    if (expected === 'file' || expected === 'dir') {
      if (!fs.existsSync(resolved)) return { error: 'path does not exist' };
      let st;
      try {
        st = fs.statSync(resolved);
      } catch (error) {
        return { error: `unable to stat path: ${error.message}` };
      }
      if (expected === 'file' && !st.isFile()) return { error: 'path is not a file' };
      if (expected === 'dir' && !st.isDirectory()) return { error: 'path is not a directory' };
    }

    return { path: resolved };
  }

  queueApprovalAction(action, promptText) {
    this.pendingActions.push({ action, promptText });
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: 'pending',
      detail: `${this.pendingActions.length + (this.pendingAction ? 1 : 0)} queued`
    });
    return true;
  }

  async dispatchAction(action, promptText) {
    this.queueApprovalAction(action, promptText);
    await this.drainPendingActions();
  }

  presentPendingApproval() {
    if (!this.pendingAction) return;
    this.loopState = 'awaiting-approval';
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: 'pending',
      detail: `${this.pendingAction.type} awaiting approval (${this.pendingActions.length} queued behind)`
    });
    const overlay = this.buildBox('Permission Required', [
      stripAnsi(this.pendingActionPrompt || `${this.pendingAction.type} queued`),
      `action ${this.pendingAction.id}`,
      '[Y] /yes    [N] /no'
    ]);
    this.print(overlay);
  }

  async drainPendingActions() {
    if (this.actionDrainActive) return;
    this.actionDrainActive = true;
    try {
      while (true) {
        if (!this.pendingAction) {
          const nextEntry = this.pendingActions.shift();
          if (!nextEntry) break;
          this.pendingAction = nextEntry.action;
          this.pendingActionPrompt = nextEntry.promptText || '';
        }

        if (this.requireApproval) {
          if (this.loopState !== 'awaiting-approval') {
            this.presentPendingApproval();
          }
          break;
        }

        const action = this.pendingAction;
        this.pendingAction = null;
        this.pendingActionPrompt = '';
        this.loopState = 'running';
        this.updateTask('io', {
          label: 'helpers/filesystem',
          state: 'active',
          detail: `${action.type} running (${this.pendingActions.length} queued behind)`
        });
        await this.executePendingAction(action);
      }
    } finally {
      this.actionDrainActive = false;
      if (!this.pendingAction && !this.pendingActions.length && this.loopState !== 'error') {
        this.updateTask('io', {
          label: 'helpers/filesystem',
          state: 'done',
          detail: 'queue empty'
        });
      }
    }
  }

  printBanner() {
    for (const line of ETHUB_ASCII) {
      this.print(style(line, ANSI.magenta));
    }
  }

  drawHeader(frame) {
    const p1 = (frame / 90) % 1;
    const p3 = (p1 + 0.66) % 1;
    this.print(LEFT_PAD + rainbowDivider(HEADER_WIDTH, p1));
    ETHUB_ASCII.forEach((line, row) => {
      this.print(LEFT_PAD + rainbowAsciiLine(line, row, ETHUB_ASCII.length, frame));
    });
    this.print(
      LEFT_PAD +
      style(
        `Mode: CHAT | Model: ${this.model} | Change Approval: ${this.requireApproval ? 'ON' : 'OFF'} | cwd: ${this.workspaceRelativePath()}`,
        ANSI.dim
      )
    );
    this.print(LEFT_PAD + rainbowDivider(HEADER_WIDTH, p3));
  }

  renderHeaderFrame(frame) {
    const p1 = (frame / 90) % 1;
    const p3 = (p1 + 0.66) % 1;
    const lines = [];
    lines.push(LEFT_PAD + rainbowDivider(HEADER_WIDTH, p1));
    ETHUB_ASCII.forEach((line, row) => {
      lines.push(LEFT_PAD + rainbowAsciiLine(line, row, ETHUB_ASCII.length, frame));
    });
    lines.push(
      LEFT_PAD +
      style(
        `Mode: CHAT | Model: ${this.model} | Approval: ${this.requireApproval ? 'ON' : 'OFF'} | cwd: ${this.workspaceRelativePath()}`,
        ANSI.dim
      )
    );
    lines.push(LEFT_PAD + rainbowDivider(HEADER_WIDTH, p3));
    return lines;
  }

  async animateHeader(durationMs = 1200, fps = 20) {
    const frameDelay = Math.max(16, Math.floor(1000 / fps));
    const frames = Math.max(1, Math.floor(durationMs / frameDelay));
    for (let frame = 0; frame < frames; frame += 1) {
      const lines = this.renderHeaderFrame(frame);
      process.stdout.write('\x1b[2J\x1b[H');
      process.stdout.write(`${lines.join('\n')}\n`);
      await new Promise((resolve) => setTimeout(resolve, frameDelay));
    }
    process.stdout.write('\x1b[2J\x1b[H');
    this.drawHeader(frames);
  }

  async showSuggestions() {
    this.print('');
    this.print(LEFT_PAD + style('Suggestions (you can just start typing):', ANSI.dim));
    for (const s of SUGGESTIONS) {
      let buf = '';
      for (const ch of s) {
        buf += ch;
        process.stdout.write(`\r${LEFT_PAD}${style(`• ${buf}`, ANSI.dim)}`);
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      process.stdout.write('\n');
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    this.print('');
  }

  startThinking() {
    if (this.thinkingTimer) return;
    let i = 0;
    this.thinkingTimer = setInterval(() => {
      const dots = '.'.repeat(i % 4);
      process.stdout.write(
        `\r${LEFT_PAD}${style('Thinking', ANSI.cyan)}${dots.padEnd(3, ' ')}${style(' parsing your request', ANSI.dim)}${' '.repeat(20)}`
      );
      i += 1;
    }, 140);
  }

  stopThinking() {
    if (!this.thinkingTimer) return;
    clearInterval(this.thinkingTimer);
    this.thinkingTimer = null;
    process.stdout.write('\n');
  }

  async handleCommand(input) {
    const commandInput = String(input || '');
    const normalizedInput = commandInput.trim();
    const [cmd, ...args] = normalizedInput.split(/\s+/);
    const command = cmd.toLowerCase();
    const commandOffset = commandInput.toLowerCase().indexOf(command);
    const commandTail = commandOffset >= 0 ? commandInput.slice(commandOffset + command.length) : '';

    if (command === '/help') {
      this.print('Commands: /help, /status, /model <name>, /approve changes on|off, /debug, /dashboard, /readfile <path>, /writefile <path> -- <content>, /cd <path>, /skills <mine|candidates|add|list|show|run>, /yes, /no, /exit');
      this.print('Skills flow: /skills mine 10 -> /skills add cand_1 my_skill -> /yes -> /skills run my_skill -> /yes');
      return;
    }

    if (command === '/status') {
      this.print(safeJson({
        model: this.model,
        ollama_url: this.ollamaUrl,
        require_approval_for_changes: this.requireApproval,
        loop_state: this.loopState,
        active_lane: this.activeLane,
        skills_count: this.skills.length,
        skill_candidates_count: this.skillCandidates.length,
        dashboard_url: this.dashboardInfo && this.dashboardInfo.dashboard_url ? this.dashboardInfo.dashboard_url : null,
        chat_url: this.dashboardInfo && this.dashboardInfo.chat_url ? this.dashboardInfo.chat_url : null,
        debug_dashboard_pid: this.debugServerProcess && !this.debugServerProcess.killed ? this.debugServerProcess.pid : null,
        history_count: this.history.length,
        pending_action: this.pendingAction ? this.pendingAction.id : null,
        pending_actions_queued: this.pendingActions.length,
        task_registry: this.taskRegistry,
        prompt_tokens_est: this.promptTokensEst,
        completion_tokens_est: this.completionTokensEst,
        total_cost_est: this.totalCostEst,
        last_latency_ms: this.lastLatencyMs,
        actions_run: this.actionsRun
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
      this.updateTask('worker', {
        label: 'worker/ollama',
        state: 'done',
        detail: `model -> ${this.model}`
      });
      this.print(`Model updated: ${this.model}`);
      return;
    }

    if (command === '/approve') {
      const target = (args[0] || '').toLowerCase();
      const mode = (args[1] || '').toLowerCase();
      const legacyMode = target;

      if (target === 'changes' && (mode === 'on' || mode === 'off')) {
        this.requireApproval = mode === 'on';
        this.print(`Change approval mode: ${mode}`);
        if (!this.requireApproval) {
          await this.drainPendingActions();
        }
        return;
      }

      if (legacyMode === 'on' || legacyMode === 'off') {
        this.requireApproval = legacyMode === 'on';
        this.print(`Change approval mode: ${legacyMode}`);
        if (!this.requireApproval) {
          await this.drainPendingActions();
        }
        return;
      }

      if (!target) {
        this.print(`Change approval mode: ${this.requireApproval ? 'on' : 'off'}`);
        return;
      }

      this.print('Usage: /approve changes on|off');
      return;
    }

    if (command === '/debug' || command === '/dashboard') {
      const info = await this.startDebugDashboard();
      this.print(style(`Debug dashboard live: ${info.dashboard_url}`, ANSI.cyan));
      this.print(style(`Debug chat live: ${info.chat_url}`, ANSI.cyan));
      this.print(style(`Token length: ${this.debugServerToken.length} (never written to file)`, ANSI.dim));
      return;
    }

    if (command === '/yes') {
      if (!this.pendingAction) {
        this.print('No pending action to approve.');
        return;
      }
      const action = this.pendingAction;
      this.loopState = 'approved';
      this.updateTask('io', {
        label: 'helpers/filesystem',
        state: 'active',
        detail: `${action.type} approved (${this.pendingActions.length} queued behind)`
      });
      this.pendingAction = null;
      this.pendingActionPrompt = '';
      await this.executePendingAction(action);
      await this.drainPendingActions();
      return;
    }

    if (command === '/no') {
      if (!this.pendingAction) {
        this.print('No pending action to reject.');
        return;
      }
      const action = this.pendingAction;
      this.pendingAction = null;
      this.pendingActionPrompt = '';
      this.loopState = 'idle';
      this.updateTask('io', {
        label: 'helpers/filesystem',
        state: 'error',
        detail: `${action.type} rejected (${this.pendingActions.length} queued behind)`
      });
      this.print(`Action ${action.id} skipped.`);
      await this.drainPendingActions();
      return;
    }

    if (command === '/exit') {
      this.rl.close();
      return;
    }

    if (command === '/cd') {
      const rawTarget = trimLeadingWhitespace(commandTail).trim();
      if (!rawTarget) {
        this.print(`Current directory: ${process.cwd()}`);
        return;
      }
      const resolved = this.resolvePathInWorkspace(rawTarget, 'dir');
      if (resolved.error) {
        this.print(`${style('cd denied:', ANSI.bold, ANSI.red)} ${resolved.error}`);
        return;
      }
      process.chdir(resolved.path);
      this.refreshPrompt();
      this.updateTask('io', {
        label: 'helpers/filesystem',
        state: 'done',
        detail: `cwd -> ${this.workspaceRelativePath()}`
      });
      this.print(style(`Directory changed to ${this.workspaceRelativePath()}`, ANSI.cyan));
      return;
    }

    if (command === '/readfile') {
      const rawPath = trimLeadingWhitespace(commandTail).trim();
      if (!rawPath) {
        this.print('Usage: /readfile <path>');
        return;
      }
      const resolved = this.resolvePathInWorkspace(rawPath, 'file');
      if (resolved.error) {
        this.print(`${style('readfile denied:', ANSI.bold, ANSI.red)} ${resolved.error}`);
        return;
      }
      const action = {
        id: `act_${Date.now()}`,
        type: 'read_file',
        payload: {
          path: resolved.path,
          rel: this.workspaceRelativePath(resolved.path)
        },
        created_at: nowIso()
      };
      await this.dispatchAction(
        action,
        `${style('Read request queued:', ANSI.bold, ANSI.yellow)} ${action.payload.rel}`
      );
      return;
    }

    if (command === '/writefile') {
      const raw = trimLeadingWhitespace(commandTail);
      const splitIndex = raw.indexOf(' -- ');
      if (splitIndex === -1) {
        this.print('Usage: /writefile <path> -- <content>');
        return;
      }
      const rawPath = raw.slice(0, splitIndex).trim();
      const content = raw.slice(splitIndex + 4);
      if (!rawPath) {
        this.print('Usage: /writefile <path> -- <content>');
        return;
      }
      const resolved = this.resolvePathInWorkspace(rawPath, 'any');
      if (resolved.error) {
        this.print(`${style('writefile denied:', ANSI.bold, ANSI.red)} ${resolved.error}`);
        return;
      }
      const action = {
        id: `act_${Date.now()}`,
        type: 'write_file',
        payload: {
          path: resolved.path,
          rel: this.workspaceRelativePath(resolved.path),
          content
        },
        created_at: nowIso()
      };
      await this.dispatchAction(
        action,
        `${style('Write request queued:', ANSI.bold, ANSI.yellow)} ${action.payload.rel} (${content.length} chars)`
      );
      return;
    }

    if (command === '/skills') {
      const sub = (args[0] || '').toLowerCase();
      if (!sub || sub === 'help') {
        this.print('Usage:');
        this.print('/skills mine [count]');
        this.print('/skills candidates');
        this.print('/skills add <candidate_id> <skill_name>');
        this.print('/skills list');
        this.print('/skills show <skill_id|skill_name>');
        this.print('/skills run <skill_id|skill_name>');
        return;
      }

      if (sub === 'mine') {
        const count = Number(args[1] || 10);
        const result = this.collectSkillCandidatesFromArtifacts(count);
        this.print(style(`Mined ${result.candidates} candidate skill patterns from artifacts (sources scanned: ${result.scannedSources}).`, ANSI.cyan));
        for (const c of this.skillCandidates) {
          this.print(style(`[${c.id}] hits=${c.hits} executable=${c.executable ? 'yes' : 'no'}`, ANSI.bold, ANSI.yellow));
          this.print('```');
          this.print(c.snippet);
          this.print('```');
          if (!c.executable) this.print(style(`reason: ${c.safety_reason}`, ANSI.dim));
        }
        return;
      }

      if (sub === 'candidates') {
        if (!this.skillCandidates.length) {
          this.print('No candidates loaded. Run /skills mine first.');
          return;
        }
        for (const c of this.skillCandidates) {
          this.print(`[${c.id}] hits=${c.hits} executable=${c.executable ? 'yes' : 'no'} source_kind=${c.source_kind}`);
        }
        return;
      }

      if (sub === 'add') {
        const candidateId = args[1] || '';
        const skillName = args.slice(2).join(' ').trim();
        if (!candidateId || !skillName) {
          this.print('Usage: /skills add <candidate_id> <skill_name>');
          return;
        }
        const existing = this.findSkill(skillName);
        if (existing) {
          this.print(`Skill already exists: ${existing.name} (${existing.id})`);
          return;
        }
        const candidate = this.findCandidate(candidateId);
        if (!candidate) {
          this.print(`Candidate not found: ${candidateId}`);
          return;
        }
        const action = {
          id: `act_${Date.now()}`,
          type: 'add_skill',
          payload: {
            skill_name: skillName,
            source_candidate: candidate.id,
            snippet: candidate.snippet,
            executable: candidate.executable
          },
          created_at: nowIso()
        };
        await this.dispatchAction(
          action,
          `${style('Add skill queued:', ANSI.bold, ANSI.yellow)} ${skillName} from ${candidate.id}`
        );
        return;
      }

      if (sub === 'list') {
        if (!this.skills.length) {
          this.print(`No approved skills yet. Skills file: ${this.skillsPath}`);
          return;
        }
        for (const skill of this.skills) {
          this.print(`[${skill.id}] ${skill.name} | executable=${skill.executable ? 'yes' : 'no'} | source=${skill.source}`);
        }
        return;
      }

      if (sub === 'show') {
        const query = args.slice(1).join(' ').trim();
        if (!query) {
          this.print('Usage: /skills show <skill_id|skill_name>');
          return;
        }
        const skill = this.findSkill(query);
        if (!skill) {
          this.print(`Skill not found: ${query}`);
          return;
        }
        this.print(style(`[${skill.id}] ${skill.name}`, ANSI.bold, ANSI.cyan));
        this.print('```');
        this.print(skill.snippet);
        this.print('```');
        return;
      }

      if (sub === 'run') {
        const query = args.slice(1).join(' ').trim();
        if (!query) {
          this.print('Usage: /skills run <skill_id|skill_name>');
          return;
        }
        const skill = this.findSkill(query);
        if (!skill) {
          this.print(`Skill not found: ${query}`);
          return;
        }
        const validation = this.validateSkillCommand(skill.snippet);
        if (!validation.ok) {
          this.print(`${style('Skill is not executable:', ANSI.bold, ANSI.red)} ${validation.reason}`);
          return;
        }
        const action = {
          id: `act_${Date.now()}`,
          type: 'run_skill',
          payload: {
            skill_id: skill.id,
            skill_name: skill.name,
            snippet: skill.snippet
          },
          created_at: nowIso()
        };
        await this.dispatchAction(
          action,
          `${style('Skill execution queued:', ANSI.bold, ANSI.yellow)} ${skill.name}\n${skill.snippet}`
        );
        return;
      }

      this.print(`Unknown skills subcommand: ${sub}`);
      return;
    }

    this.print(`Unknown command: ${command}. Use /help.`);
  }

  async executePendingAction(action) {
    if (!action) return;
    if (action.type === 'ollama_chat') {
      await this.executeAction(action);
      return;
    }
    if (action.type === 'read_file') {
      this.runReadFileAction(action);
      return;
    }
    if (action.type === 'write_file') {
      this.runWriteFileAction(action);
      return;
    }
    if (action.type === 'add_skill') {
      this.runAddSkillAction(action);
      return;
    }
    if (action.type === 'run_skill') {
      await this.runSkillCommand(action);
      return;
    }
    this.print(`Unsupported pending action type: ${action.type}`);
  }

  runReadFileAction(action) {
    const filePath = action && action.payload ? action.payload.path : '';
    if (!filePath || !fs.existsSync(filePath)) {
      this.print(`${style('Read failed:', ANSI.bold, ANSI.red)} file no longer exists.`);
      return;
    }
    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      this.print(`${style('Read failed:', ANSI.bold, ANSI.red)} ${error.message}`);
      return;
    }
    const shown = truncateText(text, MAX_READFILE_BYTES);
    const rel = action.payload.rel || this.workspaceRelativePath(filePath);
    this.print(style(`[I/O READ] ${rel}`, ANSI.bold, ANSI.cyan));
    this.print(style(`\n[READFILE] ${rel}`, ANSI.bold, ANSI.cyan));
    this.print(style(`bytes: ${Buffer.byteLength(text, 'utf8')} | shown: ${Buffer.byteLength(shown, 'utf8')}`, ANSI.dim));
    this.print(shown);
    this.loopState = 'idle';
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: 'done',
      detail: `read ${rel}`
    });
  }

  runWriteFileAction(action) {
    const filePath = action && action.payload ? action.payload.path : '';
    const content = action && action.payload ? String(action.payload.content || '') : '';
    if (!filePath) {
      this.print(`${style('Write failed:', ANSI.bold, ANSI.red)} missing target path.`);
      return;
    }
    try {
      ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      this.print(`${style('Write failed:', ANSI.bold, ANSI.red)} ${error.message}`);
      return;
    }
    this.print(style(`[I/O WRITE] ${action.payload.rel}`, ANSI.bold, ANSI.cyan));
    this.print(style(`[WRITEFILE] wrote ${content.length} chars to ${action.payload.rel}`, ANSI.bold, ANSI.cyan));
    this.loopState = 'idle';
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: 'done',
      detail: `wrote ${action.payload.rel}`
    });
  }

  runAddSkillAction(action) {
    const payload = action && action.payload ? action.payload : {};
    const name = String(payload.skill_name || '').trim();
    const snippet = String(payload.snippet || '');
    if (!name || !snippet) {
      this.print(`${style('Add skill failed:', ANSI.bold, ANSI.red)} missing skill name or snippet.`);
      return;
    }
    const duplicate = this.findSkill(name);
    if (duplicate) {
      this.print(`${style('Add skill skipped:', ANSI.bold, ANSI.red)} skill already exists (${duplicate.id}).`);
      return;
    }

    const skill = {
      id: `skill_${Date.now()}`,
      name,
      snippet,
      source: `candidate:${payload.source_candidate || 'unknown'}`,
      executable: Boolean(payload.executable),
      created_at: nowIso()
    };
    this.skills.push(skill);
    this.saveSkills();
    this.print(style(`[SKILL ADDED] ${skill.name} (${skill.id}) executable=${skill.executable ? 'yes' : 'no'}`, ANSI.bold, ANSI.cyan));
    this.loopState = 'idle';
    this.updateTask('io', {
      label: 'helpers/filesystem',
      state: 'done',
      detail: `skill added ${skill.name}`
    });
  }

  async handleUserPrompt(input) {
    const reasoning = this.determineIntentWithHopper(input);
    this.activeLane = reasoning.hopper_lane || 'general';
    this.activePrompt = input;
    this.loopState = 'planning';
    this.promptTokensEst = estimateTokens(input);
    this.updateTask('plan', {
      label: `architect/${this.activeLane}`,
      state: 'active',
      detail: `intent=${reasoning.intent}`
    });
    this.updateTask('worker', {
      label: 'worker/ollama',
      state: 'pending',
      detail: 'payload staged'
    });
    const action = {
      id: `act_${Date.now()}`,
      type: 'ollama_chat',
      prompt: input,
      reasoning_summary: reasoning,
      created_at: nowIso()
    };

    this.actionMeta[action.id] = {
      prompt: input,
      prompt_chars_before: input.length
    };
    await this.showReasoningFlow(reasoning, input);

    await this.executeAction(action);
  }

  async executeAction(action) {
    if (!action || action.type !== 'ollama_chat') {
      this.print('Unsupported action.');
      return;
    }

    this.history.push({ role: 'user', content: action.prompt });
    this.loopState = 'running';
    this.updateTask('plan', {
      label: `architect/${this.activeLane}`,
      state: 'done',
      detail: 'request shaped'
    });
    this.updateTask('worker', {
      label: 'worker/ollama',
      state: 'active',
      detail: 'waiting on local model'
    });

    const payload = {
      model: this.model,
      messages: this.history,
      stream: false
    };

    let response;
    let raw;
    const started = Date.now();
    this.startThinking();

    try {
      response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      raw = await response.text();
    } catch (error) {
      this.stopThinking();
      const message = error && error.message ? error.message : String(error);
      this.loopState = 'error';
      this.updateTask('worker', {
        label: 'worker/ollama',
        state: 'error',
        detail: truncateText(message, 48)
      });
      this.print(`Ollama request failed: ${message}`);
      return;
    }
    this.stopThinking();

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
    this.completionTokensEst = estimateTokens(assistantText);
    this.lastLatencyMs = Date.now() - started;
    this.actionsRun += 1;
    this.totalCostEst = Number((((this.promptTokensEst + this.completionTokensEst) / 1000000) * 0.1).toFixed(4));
    const hasRuntimeError = /(syntaxerror|stack overflow|runtime error|error:)/i.test(assistantText);
    this.loopState = hasRuntimeError ? 'error' : 'idle';
    this.updateTask('worker', {
      label: 'worker/ollama',
      state: hasRuntimeError ? 'error' : 'done',
      detail: hasRuntimeError ? 'response flagged an error' : 'response committed'
    });
    this.updateTask('plan', {
      label: `architect/${this.activeLane}`,
      state: hasRuntimeError ? 'error' : 'done',
      detail: hasRuntimeError ? 'follow-up needed' : 'loop complete'
    });
    this.print(assistantText);
  }
}

const agent = new EthubCliAgent();
agent.start().catch((error) => {
  process.stderr.write(`Fatal startup error: ${error && error.stack ? error.stack : String(error)}\n`);
  process.exit(1);
});
