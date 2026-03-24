#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

const ROOT = process.cwd();
const HOST = process.env.WEB_DEBUG_HOST || '0.0.0.0';
const START_PORT = Number(process.env.WEB_DEBUG_PORT || '3000');
const TOKEN_FILE = path.join(ROOT, 'web_debug', '.token');
const INDEX_HTML = path.join(ROOT, 'web_debug', 'index.html');
const CHAT_HTML = path.join(ROOT, 'web_debug', 'chat.html');
const OLLAMA_CHAT_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
const OLLAMA_TAGS_URL = process.env.OLLAMA_TAGS_URL || OLLAMA_CHAT_URL.replace(/\/api\/chat\/?$/, '/api/tags');

const SOURCES = {
  ethub: path.join(ROOT, 'ethub_cli_session_logs'),
  codex: path.join(ROOT, 'codex_logs'),
  docs: path.join(ROOT, 'docs')
};

function ensureToken() {
  if (process.env.WEB_DEBUG_TOKEN) return process.env.WEB_DEBUG_TOKEN;
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  const token = crypto.randomBytes(20).toString('hex');
  fs.writeFileSync(TOKEN_FILE, `${token}\n`, 'utf8');
  return token;
}

const TOKEN = ensureToken();
const SERVER_STARTED_AT = Date.now();
let ACTIVE_PORT = START_PORT;

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
    const base = `http://127.0.0.1:${ACTIVE_PORT}`;
    process.stdout.write(`web_debug running on ${base}/?token=${TOKEN}\n`);
    process.stdout.write(`chat interface: ${base}/chat?token=${TOKEN}\n`);
  })
  .catch((error) => {
    const msg = error && error.message ? error.message : String(error);
    process.stderr.write(`web_debug server error: ${msg}\n`);
    process.exit(1);
  });
