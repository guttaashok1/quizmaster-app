/**
 * Client-side auth helper — all credentials are handled server-side.
 * Only a signed JWT is stored in localStorage; passwords never touch the browser storage.
 */
window.Auth = (() => {
  const TOKEN_KEY = 'ic_jwt';
  const API = '/api/interview-auth';

  // ── Token helpers ──────────────────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Decode JWT payload WITHOUT verifying the signature (display only).
   * Real verification happens server-side on every API call.
   */
  function decodePayload(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  // ── Session (reads from stored JWT) ───────────────────────────────────────
  function getSession() {
    const token = getToken();
    if (!token) return null;
    const payload = decodePayload(token);
    if (!payload) { clearToken(); return null; }
    // Check JWT expiry (exp is unix seconds)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      clearToken();
      return null;
    }
    return {
      token,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      plan: payload.plan,
    };
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }
    return session;
  }

  function logout() {
    clearToken();
    // ?logout=1 tells login.html to skip the redirect-if-logged-in check
    window.location.href = '/login.html?logout=1';
  }

  /** Clear the stored token without navigating away (useful for inline stale-token recovery). */
  function clearSession() {
    clearToken();
  }

  // ── Auth header helper ─────────────────────────────────────────────────────
  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── login ──────────────────────────────────────────────────────────────────
  async function login(identifier, password) {
    if (!identifier || !password)
      return { error: 'Please enter your username and password' };
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Login failed' };
      saveToken(data.token);
      return { session: { token: data.token, username: data.username, role: data.role, plan: data.plan } };
    } catch {
      return { error: 'Network error — please try again' };
    }
  }

  // ── register ───────────────────────────────────────────────────────────────
  async function register(username, email, password) {
    // Client-side pre-validation mirrors server rules for instant feedback
    if (!username || username.trim().length < 3)
      return { error: 'Username must be at least 3 characters' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return { error: 'Please enter a valid email address' };
    if (!password || password.length < 8)
      return { error: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password))
      return { error: 'Password must contain at least one uppercase letter' };
    if (!/[0-9]/.test(password))
      return { error: 'Password must contain at least one number' };

    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Registration failed' };
      saveToken(data.token);
      return { success: true };
    } catch {
      return { error: 'Network error — please try again' };
    }
  }

  // ── Question quota ─────────────────────────────────────────────────────────
  async function recordQuestion() {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API}/question-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
    } catch { /* non-fatal */ }
  }

  // Legacy alias
  function incrementQuestionCount() { return recordQuestion(); }

  async function getQuota() {
    const token = getToken();
    if (!token) return { used: 0, remaining: 0, unlimited: false };
    try {
      const res = await fetch(`${API}/quota`, { headers: authHeaders() });
      if (!res.ok) return { used: 0, remaining: 0, unlimited: false };
      return await res.json();
    } catch {
      return { used: 0, remaining: 0, unlimited: false };
    }
  }

  async function canAskQuestion() {
    const session = getSession();
    if (!session) return false;
    const q = await getQuota();
    return q.unlimited || q.remaining > 0;
  }

  async function getRemainingQuestions() {
    const session = getSession();
    if (!session) return 0;
    const q = await getQuota();
    return q.unlimited ? Infinity : q.remaining;
  }

  // ── Nav renderer ──────────────────────────────────────────────────────────
  function renderNav() {
    const el = document.getElementById('nav-auth');
    if (!el) return;
    const session = getSession();
    if (session) {
      el.innerHTML = `
        <span class="nav-user">👤 ${session.username}</span>
        <a href="/interview/" class="btn-nav-filled">Open Coach</a>
        <button onclick="Auth.logout()" class="btn-nav-outline">Log out</button>
      `;
    } else {
      el.innerHTML = `
        <a href="/login.html" class="btn-nav-outline">Sign In</a>
        <a href="/register.html" class="btn-nav-filled">Get Started</a>
      `;
    }
  }

  return {
    login, logout, register, clearSession,
    getSession, requireAuth, renderNav,
    canAskQuestion, getRemainingQuestions,
    recordQuestion, incrementQuestionCount,
    getQuota, authHeaders,
  };
})();
