#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const STATIC_WEB_DEBUG_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_WEB_DEBUG_DIR = path.join(ROOT, 'web_debug');
const HOST = process.env.WEB_DEBUG_HOST || '127.0.0.1';
const START_PORT = Number(process.env.WEB_DEBUG_PORT || '3000');
const RUNTIME_FILE = path.join(WORKSPACE_WEB_DEBUG_DIR, 'runtime.json');
const INDEX_HTML = path.join(STATIC_WEB_DEBUG_DIR, 'index.html');
const CHAT_HTML = path.join(STATIC_WEB_DEBUG_DIR, 'chat.html');
const OLLAMA_CHAT_URL = process.env.OLLAMA_URL || 'http://206.189.237.213:11434/api/chat';
const OLLAMA_TAGS_URL = process.env.OLLAMA_TAGS_URL || OLLAMA_CHAT_URL.replace(/\/api\/chat\/?$/, '/api/tags');

const SOURCES = {
  ethub: path.join(ROOT, 'ethub_cli_session_logs'),
  chat: path.join(ROOT, 'web_debug', 'chat_sessions'),
  codex: path.join(ROOT, 'codex_logs'),
  docs: path.join(ROOT, 'docs')
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(WORKSPACE_WEB_DEBUG_DIR);

for (const key of Object.keys(SOURCES)) {
  ensureDir(SOURCES[key]);
}

let TOKEN = '';
const SERVER_STARTED_AT = Date.now();
let ACTIVE_PORT = START_PORT;

function writeRuntimeFile(port) {
  const payload = {
    pid: process.pid,
    host: HOST,
    port,
    started_at: new Date(SERVER_STARTED_AT).toISOString()
  };
  fs.writeFileSync(RUNTIME_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function clearRuntimeFile() {
  if (!fs.existsSync(RUNTIME_FILE)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'));
    if (parsed && Number(parsed.pid) !== process.pid) return;
  } catch {
    // best effort cleanup
  }
  try {
    fs.unlinkSync(RUNTIME_FILE);
  } catch {
    // ignore
  }
}

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}

function sendHtml(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function safeList(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir).sort().reverse();
}

function requireToken(reqUrl) {
  const u = new URL(reqUrl, `http://local`);
  return u.searchParams.get('token') === TOKEN;
}

function rotateEphemeralToken() {
  // 256 random bytes; held in memory only and never written to files.
  TOKEN = crypto.randomBytes(256).toString('hex');
}

function safeJoin(baseDir, relPath) {
  const cleanRel = String(relPath || '').replace(/\\/g, '/');
  const target = path.resolve(baseDir, cleanRel);
  const base = path.resolve(baseDir);
  if (target === base || target.startsWith(`${base}${path.sep}`)) return target;
  return null;
}

function readTextLimited(filePath, maxBytes = 500000) {
  if (!fs.existsSync(filePath)) return '';
  const st = fs.statSync(filePath);
  const start = Math.max(0, st.size - maxBytes);
  const fd = fs.openSync(filePath, 'r');
  try {
    const len = st.size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function readJsonLine(pathName, matcher) {
  if (!fs.existsSync(pathName)) return null;
  const raw = fs.readFileSync(pathName, 'utf8');
  const lines = raw.split('\n');
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    try {
      const obj = JSON.parse(text);
      if (matcher(obj)) return obj;
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

function readJsonlTail(pathName, maxCount = 500) {
  if (!fs.existsSync(pathName)) return [];
  const raw = fs.readFileSync(pathName, 'utf8');
  const lines = raw.split('\n').filter((line) => line.trim());
  const out = [];
  const start = Math.max(0, lines.length - maxCount);
  for (let i = start; i < lines.length; i += 1) {
    try {
      out.push(JSON.parse(lines[i]));
    } catch {
      // skip malformed rows
    }
  }
  return out;
}

function makeChatSessionId() {
  const iso = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const rand = crypto.randomBytes(3).toString('hex');
  return `chat_${iso}_${rand}`;
}

function resolveChatSessionDir(sessionId) {
  if (!sessionId) return null;
  const dir = safeJoin(SOURCES.chat, sessionId);
  if (!dir) return null;
  return dir;
}

function appendJsonl(filePath, obj) {
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

function writeChatMeta(sessionDir, patch) {
  const metaPath = path.join(sessionDir, 'meta.json');
  let current = {};
  if (fs.existsSync(metaPath)) {
    try {
      current = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
    } catch {
      current = {};
    }
  }
  const next = { ...current, ...patch };
  fs.writeFileSync(metaPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function readChatEvents(sessionDir, maxCount = 500) {
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  if (!fs.existsSync(eventsPath)) return [];
  const raw = fs.readFileSync(eventsPath, 'utf8');
  const rows = raw.split('\n').filter((x) => x.trim());
  const out = [];
  const start = Math.max(0, rows.length - maxCount);
  for (let i = start; i < rows.length; i += 1) {
    try {
      out.push(JSON.parse(rows[i]));
    } catch {
      // skip malformed row
    }
  }
  return out;
}

function resolveSessionName(source) {
  if (source !== 'ethub') return '';
  const latestPath = path.join(SOURCES.ethub, 'LATEST_SESSION.txt');
  if (fs.existsSync(latestPath)) {
    const fromLatest = fs.readFileSync(latestPath, 'utf8').trim();
    if (fromLatest) return fromLatest;
  }
  const entries = safeList(SOURCES.ethub).filter((name) => name.startsWith('session_'));
  return entries[0] || '';
}

function getSessionStartIso(source, session) {
  const base = SOURCES[source];
  if (!base || !session) return null;
  const dir = safeJoin(base, session);
  if (!dir || !fs.existsSync(dir)) return null;

  const eventsPath = path.join(dir, 'events.jsonl');
  const event = readJsonLine(eventsPath, (obj) => obj && obj.type === 'session_start');
  if (event && event.payload && event.payload.started_at) {
    return String(event.payload.started_at);
  }

  const statePath = path.join(dir, 'state.json');
  if (fs.existsSync(statePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (parsed && parsed.started_at) return String(parsed.started_at);
    } catch {
      // ignore malformed JSON
    }
  }

  return null;
}

function buildIndexHtml() {
  if (fs.existsSync(INDEX_HTML)) return fs.readFileSync(INDEX_HTML, 'utf8');
  return '<!doctype html><meta charset="utf-8"><title>web_debug missing index.html</title>';
}

function buildChatHtml() {
  if (fs.existsSync(CHAT_HTML)) return fs.readFileSync(CHAT_HTML, 'utf8');
  return '<!doctype html><meta charset="utf-8"><title>web_debug missing chat.html</title>';
}

function readJsonBody(req, maxBytes = 1000000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, text, json: parsed };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${ACTIVE_PORT}`);

  if (u.pathname === '/') {
    return sendHtml(res, 200, buildIndexHtml());
  }

  if (u.pathname === '/chat') {
    return sendHtml(res, 200, buildChatHtml());
  }

  if (!['/api/sources', '/api/health'].includes(u.pathname) && !requireToken(req.url)) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  if (u.pathname === '/api/sources') {
    return sendJson(res, 200, {
      sources: Object.keys(SOURCES).map((k) => ({ key: k, root: SOURCES[k] }))
    });
  }

  if (u.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      now: new Date().toISOString(),
      uptime_ms: Date.now() - SERVER_STARTED_AT
    });
  }

  if (u.pathname === '/api/ollama-health') {
    try {
      const r = await fetchJson(OLLAMA_TAGS_URL);
      return sendJson(res, 200, {
        ok: r.ok,
        status: r.status,
        model_count: r.json && Array.isArray(r.json.models) ? r.json.models.length : 0
      });
    } catch (error) {
      return sendJson(res, 200, { ok: false, error: error && error.message ? error.message : String(error) });
    }
  }

  if (u.pathname === '/api/models') {
    try {
      const r = await fetchJson(OLLAMA_TAGS_URL);
      if (!r.ok) return sendJson(res, 502, { error: 'ollama_tags_failed', status: r.status, body: r.text.slice(0, 400) });
      const models = r.json && Array.isArray(r.json.models)
        ? r.json.models.map((m) => (m && m.name ? String(m.name) : '')).filter(Boolean)
        : [];
      return sendJson(res, 200, { models });
    } catch (error) {
      return sendJson(res, 502, { error: 'ollama_unreachable', message: error && error.message ? error.message : String(error) });
    }
  }

  if (u.pathname === '/api/chat') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: error && error.message ? error.message : String(error) });
    }

    const model = String(body.model || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return sendJson(res, 400, { error: 'messages_required' });

    const payload = { model, messages, stream: false };
    if (typeof body.temperature === 'number') {
      payload.options = { temperature: body.temperature };
    }

    try {
      const r = await fetchJson(OLLAMA_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) return sendJson(res, 502, { error: 'ollama_chat_failed', status: r.status, body: r.text.slice(0, 400) });
      return sendJson(res, 200, r.json || { message: { role: 'assistant', content: r.text } });
    } catch (error) {
      return sendJson(res, 502, { error: 'ollama_unreachable', message: error && error.message ? error.message : String(error) });
    }
  }

  if (u.pathname === '/api/chat-session/start') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    const sessionId = makeChatSessionId();
    const dir = resolveChatSessionDir(sessionId);
    if (!dir) return sendJson(res, 500, { error: 'session_dir_invalid' });
    ensureDir(dir);
    const startedAt = new Date().toISOString();
    writeChatMeta(dir, { session_id: sessionId, started_at: startedAt, ended_at: null, cleared_at: null });
    appendJsonl(path.join(dir, 'events.jsonl'), {
      ts: startedAt,
      type: 'chat_session_start',
      session_id: sessionId
    });
    return sendJson(res, 200, { session_id: sessionId, started_at: startedAt });
  }

  if (u.pathname === '/api/chat-session/event') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: error && error.message ? error.message : String(error) });
    }
    const sessionId = String(body.session_id || '').trim();
    const eventType = String(body.type || 'message').trim();
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
    if (!sessionId) return sendJson(res, 400, { error: 'session_id_required' });
    const dir = resolveChatSessionDir(sessionId);
    if (!dir) return sendJson(res, 400, { error: 'invalid_session_id' });
    ensureDir(dir);
    const eventsPath = path.join(dir, 'events.jsonl');
    const ts = new Date().toISOString();
    appendJsonl(eventsPath, {
      ts,
      type: eventType,
      session_id: sessionId,
      payload
    });
    if (eventType === 'message') {
      writeChatMeta(dir, { last_event_at: ts });
    }
    return sendJson(res, 200, { ok: true, session_id: sessionId });
  }

  if (u.pathname === '/api/chat-session') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    const sessionId = String(u.searchParams.get('session_id') || '').trim();
    if (!sessionId) return sendJson(res, 400, { error: 'session_id_required' });
    const dir = resolveChatSessionDir(sessionId);
    if (!dir || !fs.existsSync(dir)) return sendJson(res, 404, { error: 'session_not_found' });
    const metaPath = path.join(dir, 'meta.json');
    let meta = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
      } catch {
        meta = {};
      }
    }
    const events = readChatEvents(dir, 2000);
    return sendJson(res, 200, { session_id: sessionId, meta, events });
  }

  if (u.pathname === '/api/chat-session/clear') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: error && error.message ? error.message : String(error) });
    }
    const sessionId = String(body.session_id || '').trim();
    if (!sessionId) return sendJson(res, 400, { error: 'session_id_required' });
    const dir = resolveChatSessionDir(sessionId);
    if (!dir || !fs.existsSync(dir)) return sendJson(res, 404, { error: 'session_not_found' });
    const clearedAt = new Date().toISOString();
    appendJsonl(path.join(dir, 'events.jsonl'), {
      ts: clearedAt,
      type: 'chat_session_cleared',
      session_id: sessionId
    });
    writeChatMeta(dir, { ended_at: clearedAt, cleared_at: clearedAt });
    const token = String(u.searchParams.get('token') || '');
    const qs = new URLSearchParams({
      source: 'chat',
      session: sessionId,
      file: 'events.jsonl'
    });
    if (token) qs.set('token', token);
    return sendJson(res, 200, { ok: true, session_id: sessionId, dashboard_path: `/?${qs.toString()}` });
  }

  if (u.pathname === '/api/session-status') {
    const source = u.searchParams.get('source') || 'ethub';
    let session = u.searchParams.get('session') || '';
    if (!session) session = resolveSessionName(source);
    const startedAt = getSessionStartIso(source, session);
    const startedMs = startedAt ? Date.parse(startedAt) : NaN;
    const elapsedMs = Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : null;
    return sendJson(res, 200, {
      source,
      session,
      started_at: startedAt,
      elapsed_ms: elapsedMs
    });
  }

  if (u.pathname === '/api/ethub-insights') {
    const session = resolveSessionName('ethub');
    if (!session) {
      return sendJson(res, 200, {
        ok: true,
        session: '',
        started_at: null,
        skills_total: 0,
        pending_action: null,
        approvals: { approved: 0, rejected: 0 },
        metrics: { mined_batches: 0, mined_candidates_total: 0, skills_added: 0, skill_runs: 0, skill_run_failures: 0 },
        recent: []
      });
    }

    const sessionDir = safeJoin(SOURCES.ethub, session);
    const eventsPath = sessionDir ? path.join(sessionDir, 'events.jsonl') : '';
    const statePath = sessionDir ? path.join(sessionDir, 'state.jsonl') : '';
    const events = readJsonlTail(eventsPath, 2000);
    const stateRows = readJsonlTail(statePath, 300);
    const lastState = stateRows.length ? stateRows[stateRows.length - 1] : null;
    const startEvent = events.find((evt) => evt && evt.type === 'session_start') || null;

    let skillsTotal = 0;
    const skillsPath = path.join(ROOT, 'ethub_cli_skills.json');
    if (fs.existsSync(skillsPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
        if (parsed && Array.isArray(parsed.skills)) {
          skillsTotal = parsed.skills.length;
        }
      } catch {
        skillsTotal = 0;
      }
    }

    let approvedCount = 0;
    let rejectedCount = 0;
    let minedBatches = 0;
    let minedCandidatesTotal = 0;
    let skillsAdded = 0;
    let skillRuns = 0;
    let skillRunFailures = 0;

    for (const evt of events) {
      if (!evt || typeof evt !== 'object') continue;
      if (evt.type === 'approval') {
        if (evt.payload && evt.payload.approved === true) approvedCount += 1;
        if (evt.payload && evt.payload.approved === false) rejectedCount += 1;
      }
      if (evt.type === 'skills_mined') {
        minedBatches += 1;
        minedCandidatesTotal += Number((evt.payload && evt.payload.candidates) || 0);
      }
      if (evt.type === 'skill_added') skillsAdded += 1;
      if (evt.type === 'skill_run_complete') {
        skillRuns += 1;
        const code = Number(evt.payload && evt.payload.code);
        if (Number.isFinite(code) && code !== 0) skillRunFailures += 1;
      }
    }

    const recent = events
      .filter((evt) => evt && ['skills_mined', 'skill_added', 'skill_run_complete', 'approval', 'action_queued'].includes(evt.type))
      .slice(-12)
      .map((evt) => ({
        ts: evt.ts || null,
        type: evt.type,
        payload: evt.payload || null
      }));

    return sendJson(res, 200, {
      ok: true,
      session,
      started_at: startEvent && startEvent.payload ? startEvent.payload.started_at || null : null,
      model: startEvent && startEvent.payload ? startEvent.payload.model_default || null : null,
      skills_total: skillsTotal,
      pending_action: lastState ? lastState.pending_action || null : null,
      approvals: { approved: approvedCount, rejected: rejectedCount },
      metrics: {
        mined_batches: minedBatches,
        mined_candidates_total: minedCandidatesTotal,
        skills_added: skillsAdded,
        skill_runs: skillRuns,
        skill_run_failures: skillRunFailures
      },
      recent
    });
  }

  if (u.pathname === '/api/ethub-io') {
    const session = resolveSessionName('ethub');
    if (!session) {
      return sendJson(res, 200, { ok: true, session: '', events: [] });
    }
    const sessionDir = safeJoin(SOURCES.ethub, session);
    const eventsPath = sessionDir ? path.join(sessionDir, 'events.jsonl') : '';
    const events = readJsonlTail(eventsPath, 3000);
    const ioTypes = new Set(['stdin', 'stdout', 'read_file', 'write_file', 'action_start', 'action_result', 'action_failure']);
    const rows = events
      .filter((evt) => evt && ioTypes.has(evt.type))
      .slice(-80)
      .map((evt) => ({
        ts: evt.ts || null,
        type: evt.type,
        payload: evt.payload || {}
      }));
    return sendJson(res, 200, { ok: true, session, events: rows });
  }

  if (u.pathname === '/api/list') {
    const source = u.searchParams.get('source') || '';
    const base = SOURCES[source];
    if (!base) return sendJson(res, 400, { error: 'invalid_source' });
    return sendJson(res, 200, { source, entries: safeList(base) });
  }

  if (u.pathname === '/api/list-files') {
    const source = u.searchParams.get('source') || '';
    const session = u.searchParams.get('session') || '';
    const base = SOURCES[source];
    if (!base) return sendJson(res, 400, { error: 'invalid_source' });
    const target = safeJoin(base, session);
    if (!target || !fs.existsSync(target)) return sendJson(res, 404, { error: 'not_found' });
    const targetStat = fs.statSync(target);
    let entries;
    if (targetStat.isDirectory()) {
      entries = fs.readdirSync(target).map((name) => {
        const fp = path.join(target, name);
        const st = fs.statSync(fp);
        return { name, type: st.isDirectory() ? 'dir' : 'file', size: st.size };
      });
    } else {
      entries = [{ name: path.basename(target), type: 'file', size: targetStat.size }];
    }
    return sendJson(res, 200, { source, session, entries });
  }

  if (u.pathname === '/api/read') {
    const source = u.searchParams.get('source') || '';
    const session = u.searchParams.get('session') || '';
    const file = u.searchParams.get('file') || '';
    const base = SOURCES[source];
    if (!base) return sendJson(res, 400, { error: 'invalid_source' });
    const dir = safeJoin(base, session);
    if (!dir || !fs.existsSync(dir)) return sendJson(res, 400, { error: 'invalid_session' });

    let fp;
    const dirStat = fs.statSync(dir);
    if (dirStat.isDirectory()) {
      fp = safeJoin(dir, file);
    } else {
      fp = file ? safeJoin(base, file) : dir;
    }

    if (!fp || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      return sendJson(res, 404, { error: 'file_not_found' });
    }
    const content = readTextLimited(fp);
    return sendJson(res, 200, { source, session, file, content });
  }

  return sendJson(res, 404, { error: 'not_found' });
});

function listenWithPortFallback(startPort, maxOffset = 20) {
  return new Promise((resolve, reject) => {
    const attempt = (port, offset) => {
      rotateEphemeralToken();

      const onError = (error) => {
        server.off('listening', onListening);
        if (error && error.code === 'EADDRINUSE' && offset < maxOffset) {
          attempt(port + 1, offset + 1);
          return;
        }
        reject(error);
      };

      const onListening = () => {
        server.off('error', onError);
        resolve(port);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, HOST);
    };

    attempt(startPort, 0);
  });
}

listenWithPortFallback(START_PORT, 30)
  .then((port) => {
    ACTIVE_PORT = port;
    writeRuntimeFile(port);
    const base = `http://127.0.0.1:${ACTIVE_PORT}`;
    process.stdout.write(`web_debug running on ${base}/?token=${TOKEN}\n`);
    process.stdout.write(`chat interface: ${base}/chat?token=${TOKEN}\n`);
  })
  .catch((error) => {
    const msg = error && error.message ? error.message : String(error);
    process.stderr.write(`web_debug server error: ${msg}\n`);
    process.exit(1);
  });

process.on('SIGINT', () => {
  clearRuntimeFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearRuntimeFile();
  process.exit(0);
});

process.on('exit', () => {
  clearRuntimeFile();
});
