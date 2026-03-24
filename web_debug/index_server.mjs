#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = Number(process.env.WEB_DEBUG_PORT || '3000');
const TOKEN_FILE = path.join(ROOT, 'web_debug', '.token');
const INDEX_HTML = path.join(ROOT, 'web_debug', 'index.html');

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
  const u = new URL(reqUrl, `http://${HOST}:${PORT}`);
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

function buildIndexHtml() {
  if (fs.existsSync(INDEX_HTML)) return fs.readFileSync(INDEX_HTML, 'utf8');
  return '<!doctype html><meta charset="utf-8"><title>web_debug missing index.html</title>';
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);

  if (u.pathname === '/') {
    return sendHtml(res, 200, buildIndexHtml());
  }

  if (!requireToken(req.url)) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  if (u.pathname === '/api/sources') {
    return sendJson(res, 200, {
      sources: Object.keys(SOURCES).map((k) => ({ key: k, root: SOURCES[k] }))
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
    const entries = fs.readdirSync(target).map((name) => {
      const fp = path.join(target, name);
      const st = fs.statSync(fp);
      return { name, type: st.isDirectory() ? 'dir' : 'file', size: st.size };
    });
    return sendJson(res, 200, { source, session, entries });
  }

  if (u.pathname === '/api/read') {
    const source = u.searchParams.get('source') || '';
    const session = u.searchParams.get('session') || '';
    const file = u.searchParams.get('file') || '';
    const base = SOURCES[source];
    if (!base) return sendJson(res, 400, { error: 'invalid_source' });
    const dir = safeJoin(base, session);
    if (!dir) return sendJson(res, 400, { error: 'invalid_session' });
    const fp = safeJoin(dir, file);
    if (!fp || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      return sendJson(res, 404, { error: 'file_not_found' });
    }
    const content = readTextLimited(fp);
    return sendJson(res, 200, { source, session, file, content });
  }

  return sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`web_debug running on http://${HOST}:${PORT}/?token=${TOKEN}\n`);
});
