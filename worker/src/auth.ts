import type { Env, User } from './types.ts';

const COOKIE_SESSION = '__session';
const COOKIE_CSRF    = '__csrf';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── CSRF ─────────────────────────────────────────────────────────────────────

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── HMAC SESSION TOKEN ───────────────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const nonce = randomHex(16);
  const message = `${userId}:${timestamp}:${nonce}`;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return `${b64url(new TextEncoder().encode(message))}.${b64url(sig)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const messagePart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  try {
    const message = new TextDecoder().decode(b64urlDecode(messagePart));
    const sig = b64urlDecode(sigPart);
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(message));
    if (!valid) return null;
    const [userId, timestamp] = message.split(':');
    if (Date.now() - parseInt(timestamp) > SESSION_TTL_MS) return null;
    return userId;
  } catch {
    return null;
  }
}

// ─── COOKIE HELPERS ───────────────────────────────────────────────────────────

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq).trim());
    const val = decodeURIComponent(part.slice(eq + 1).trim());
    if (key) result[key] = val;
  }
  return result;
}

function sessionCookie(value: string, maxAge: number): string {
  return `${COOKIE_SESSION}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function csrfCookie(value: string): string {
  return `${COOKIE_CSRF}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`;
}

// ─── REQUIRE AUTH ─────────────────────────────────────────────────────────────

export async function requireAuth(request: Request, env: Env): Promise<string | null> {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies[COOKIE_SESSION];
  if (!token) return null;
  return verifySessionToken(decodeURIComponent(token), env.SESSION_SECRET);
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

export async function handleLogin(env: Env): Promise<Response> {
  const csrf = randomHex();
  const params = new URLSearchParams({
    client_id:     env.GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri(env),
    response_type: 'code',
    scope:         'openid email profile',
    state:         csrf,
    access_type:   'online',
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location:   `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'Set-Cookie': csrfCookie(csrf),
    },
  });
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookies = parseCookies(request.headers.get('Cookie'));
  if (!code || !state || state !== cookies[COOKIE_CSRF]) {
    return new Response('Invalid OAuth state', { status: 400 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  redirectUri(env),
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) return new Response('Token exchange failed', { status: 502 });

  const { id_token } = await tokenRes.json() as { id_token: string };

  // Decode JWT payload (no signature verification needed — we just exchanged with Google)
  let payload: { sub: string; email: string; name: string; picture: string };
  try {
    payload = JSON.parse(atob(id_token.split('.')[1]));
  } catch {
    return new Response('Invalid token from Google', { status: 502 });
  }

  // Upsert user in D1
  const now = Date.now();
  const existingUser = await env.DB.prepare(
    'SELECT id FROM users WHERE google_id = ?'
  ).bind(payload.sub).first<{ id: string }>();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await env.DB.prepare(
      'UPDATE users SET email=?, name=?, picture=?, last_seen=? WHERE id=?'
    ).bind(payload.email, payload.name, payload.picture, now, userId).run();
  } else {
    userId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO users (id, google_id, email, name, picture, created_at, last_seen) VALUES (?,?,?,?,?,?,?)'
    ).bind(userId, payload.sub, payload.email, payload.name, payload.picture, now, now).run();
  }

  const token = await createSessionToken(userId, env.SESSION_SECRET);

  return new Response(null, {
    status: 302,
    headers: {
      Location:   env.ALLOWED_ORIGIN,
      'Set-Cookie': sessionCookie(token, SESSION_TTL_MS / 1000),
    },
  });
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const user = await env.DB.prepare(
    'SELECT id, email, name, picture FROM users WHERE id = ?'
  ).bind(userId).first<Omit<User, 'google_id'>>();

  if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
  return new Response(JSON.stringify(user), { headers: { 'Content-Type': 'application/json' } });
}

export function handleLogout(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie':   sessionCookie('', 0),
    },
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function redirectUri(env: Env): string {
  const isLocal = env.ALLOWED_ORIGIN.includes('localhost');
  return isLocal
    ? 'http://localhost:8787/auth/callback'
    : 'https://api.housespecial.stephendove.com/auth/callback';
}
