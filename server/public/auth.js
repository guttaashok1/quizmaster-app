window.Auth = (() => {
  const SALT = 'ic-salt-2026';
  const SESSION_KEY = 'ic_session';
  const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashPassword(pwd) {
    return sha256(pwd + SALT);
  }

  function getUsers() {
    return JSON.parse(localStorage.getItem('ic_users') || '[]');
  }

  function saveUsers(users) {
    localStorage.setItem('ic_users', JSON.stringify(users));
  }

  async function ensureAdmin() {
    const users = getUsers();
    if (users.find(u => u.username === 'admin')) return;
    const hash = await hashPassword('Admin@2026');
    users.unshift({
      username: 'admin',
      email: 'admin@interviewcoach.ai',
      passwordHash: hash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
  }

  // ── Session (localStorage + expiry) ───────────────────────────────────────
  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      // Expire after TTL
      if (s.expiresAt && Date.now() > s.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...session,
      expiresAt: Date.now() + SESSION_TTL_MS,
    }));
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
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '/';
  }

  async function login(identifier, password) {
    await ensureAdmin();
    if (!identifier || !password) return { error: 'Please enter your username and password' };
    const hash = await hashPassword(password);
    const user = getUsers().find(
      u => (u.username === identifier.trim() || u.email === identifier.trim().toLowerCase()) && u.passwordHash === hash
    );
    if (!user) return { error: 'Invalid username or password' };
    const session = {
      username: user.username,
      email: user.email,
      role: user.role,
      plan: user.plan || 'free',
      token: crypto.randomUUID(),
    };
    saveSession(session);
    return { session };
  }

  async function register(username, email, password) {
    await ensureAdmin();
    if (!username || username.trim().length < 3) return { error: 'Username must be at least 3 characters' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { error: 'Please enter a valid email address' };
    if (!password || password.length < 8) return { error: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { error: 'Password must contain at least one uppercase letter' };
    if (!/[0-9]/.test(password)) return { error: 'Password must contain at least one number' };
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()))
      return { error: 'Username already taken' };
    if (users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()))
      return { error: 'Email already registered' };
    const hash = await hashPassword(password);
    users.push({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hash,
      role: 'user',
      plan: 'free',
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
    return { success: true };
  }

  // ── Question limit helpers ────────────────────────────────────────────────
  function getTodayKey() {
    return 'ic_q_' + new Date().toISOString().slice(0, 10);
  }
  function getQuestionsUsedToday() {
    return parseInt(localStorage.getItem(getTodayKey()) || '0');
  }
  function recordQuestion() {
    localStorage.setItem(getTodayKey(), String(getQuestionsUsedToday() + 1));
  }
  // Legacy alias
  function incrementQuestionCount() { recordQuestion(); }

  function canAskQuestion() {
    const session = getSession();
    if (!session) return false;
    if (session.role === 'admin' || session.plan === 'pro') return true;
    return getQuestionsUsedToday() < 10;
  }
  function getRemainingQuestions() {
    const session = getSession();
    if (!session) return 0;
    if (session.role === 'admin' || session.plan === 'pro') return Infinity;
    return Math.max(0, 10 - getQuestionsUsedToday());
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
    ensureAdmin, login, logout, register,
    getSession, requireAuth, renderNav,
    canAskQuestion, getRemainingQuestions,
    recordQuestion, incrementQuestionCount,
  };
})();
