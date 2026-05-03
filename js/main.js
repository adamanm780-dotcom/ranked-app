/* ============================================================
   RANKED — App logic
   ============================================================ */

(function () {
  const D = window.DATA;
  const STORAGE_KEY = 'ranked.user.v2';
  const ACTIVITY_KEY = 'ranked.activity.v1';

  /* ─── state ─── */
  let state = {
    user: null,
    pending: null,
    activeTab: 'friends',          // leaderboard tab
    activeCat: 'finanzen',         // add-achievement modal
    activeFilter: 'all',           // ranking category filter
    profileViewing: null,
    history: ['splash'],
    activityStream: null,          // built once
    addedFriends: [],              // search-added friend ids
    reactions: {},                 // { [activityId]: { fire?: true, heart?: true, clap?: true } }
    challenges: null,              // [{ id, from, to, achievementId, stake, deadline, status, ...}]
    lastShare: null,               // { achievement, date } — for share-modal
  };

  /* ─── theme ─── */
  function loadTheme() {
    const stored = localStorage.getItem('ranked.theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return 'auto';
  }
  function applyTheme(mode) {
    if (mode === 'auto') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      document.documentElement.dataset.theme = mode;
    }
    // Update meta theme-color
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#0A0A0B' : '#FAFAF7');
  }
  function setTheme(mode) {
    if (!['light', 'dark', 'auto'].includes(mode)) return;
    if (mode === 'auto') localStorage.removeItem('ranked.theme');
    else localStorage.setItem('ranked.theme', mode);
    applyTheme(mode);
    updateThemeButtons();
  }
  function updateThemeButtons() {
    const current = loadTheme();
    $$('[data-theme-set]').forEach(b => {
      b.classList.toggle('seg__btn--active', b.dataset.themeSet === current);
    });
  }
  // listen for system change in auto mode
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener && mq.addEventListener('change', () => {
      if (loadTheme() === 'auto') applyTheme('auto');
    });
  }
  applyTheme(loadTheme()); // apply immediately on load

  /* ─── IndexedDB photo storage ─── */
  let _photoDb = null;
  function photoDb() {
    if (_photoDb) return _photoDb;
    _photoDb = new Promise((resolve, reject) => {
      const req = indexedDB.open('ranked.photos', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
    return _photoDb;
  }
  async function savePhoto(id, blob) {
    try {
      const db = await photoDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put({ id, blob, savedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { console.warn('photo save failed', e); }
  }
  async function loadPhoto(id) {
    try {
      const db = await photoDb();
      return new Promise((resolve) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }
  async function getPhotoUrl(id) {
    const blob = await loadPhoto(id);
    return blob ? URL.createObjectURL(blob) : null;
  }

  /* ─── persistence ─── */
  function loadUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveUser() {
    if (state.user) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.user));
  }
  function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    state.user = null;
    state.reactions = {};
    state.addedFriends = [];
  }
  function loadReactions() {
    try { return JSON.parse(localStorage.getItem('ranked.reactions') || '{}'); } catch (e) { return {}; }
  }
  function saveReactions() {
    localStorage.setItem('ranked.reactions', JSON.stringify(state.reactions));
  }
  function loadChallenges() {
    try {
      const stored = JSON.parse(localStorage.getItem('ranked.challenges') || 'null');
      if (stored && Array.isArray(stored)) return stored;
    } catch (e) {}
    return D.MOCK_CHALLENGES.map(c => ({ ...c }));
  }
  function saveChallenges() {
    localStorage.setItem('ranked.challenges', JSON.stringify(state.challenges));
  }

  /* ─── compute ─── */
  function userScore(u) {
    const ach = (u.achievements || []).reduce((sum, ach) => {
      const def = findAchievementAny(ach.id);
      return sum + (def ? def.points : 0);
    }, 0);
    return ach + (u.bonusPoints || 0);
  }
  function userCategoryPoints(u) {
    const out = { finanzen: 0, fitness: 0, skills: 0, streaks: 0 };
    (u.achievements || []).forEach(ach => {
      const def = findAchievementAny(ach.id);
      if (def) out[def.cat] += def.points;
    });
    return out;
  }
  function userCategoryCount(u) {
    const out = { finanzen: 0, fitness: 0, skills: 0, streaks: 0 };
    (u.achievements || []).forEach(ach => {
      const def = findAchievementAny(ach.id);
      if (def) out[def.cat] += 1;
    });
    return out;
  }

  function meAsBoardEntry() {
    return {
      id: 'me',
      name: state.user.name + ' (Du)',
      city: state.user.city,
      score: userScore(state.user),
      categoryPoints: userCategoryPoints(state.user),
      achievements: state.user.achievements,
      trophies: state.user.trophies,
      isMe: true,
    };
  }

  function friendsList() {
    return [...D.FRIENDS, ...state.addedFriends.map(id => D.SEARCH_POOL.find(s => s.id === id)).filter(Boolean).map(s => ({
      id: s.id, name: s.name, city: s.city, score: s.score,
      categoryPoints: { finanzen: Math.round(s.score * 0.4), fitness: Math.round(s.score * 0.3), skills: Math.round(s.score * 0.2), streaks: Math.round(s.score * 0.1) },
      achievements: [], trophies: [],
    }))];
  }

  function friendsRanking() {
    const me = meAsBoardEntry();
    const list = [me, ...friendsList()];
    list.sort((a, b) => filterScore(b) - filterScore(a));
    return list;
  }

  function cityRanking() {
    const me = meAsBoardEntry();
    const list = D.CITY_USERS.map(u => ({ ...u }));
    list.push(me);
    list.sort((a, b) => filterScore(b) - filterScore(a));
    list.forEach((u, i) => u.cityRank = i + 1);
    const top = list.slice(0, 100);
    if (!top.find(u => u.isMe)) top.push(me);
    return top;
  }

  function filterScore(u) {
    if (state.activeFilter === 'all') return u.score || 0;
    return (u.categoryPoints && u.categoryPoints[state.activeFilter]) || 0;
  }

  function myFriendRank() { return friendsRanking().findIndex(u => u.isMe) + 1; }
  function myFriendTotal() { return friendsList().length + 1; }
  function myCityRank() {
    const r = cityRanking();
    const idx = r.findIndex(u => u.isMe);
    return idx >= 0 ? idx + 1 : '—';
  }

  /* ─── DOM ─── */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function setText(target, value) {
    $$(`[data-bind="${target}"]`).forEach(el => el.textContent = value);
  }
  function setHtml(target, html) {
    const el = $(`[data-bind="${target}"]`);
    if (el) el.innerHTML = html;
  }

  function fmtNum(n) { return Number(n).toLocaleString('de-DE'); }

  // Tier badge based on points
  function tierFor(points) {
    if (points >= 5000) return { id: 'legend', label: 'Legend' };
    if (points >= 2000) return { id: 'plat',   label: 'Platin' };
    if (points >= 1000) return { id: 'gold',   label: 'Gold' };
    if (points >= 500)  return { id: 'silver', label: 'Silber' };
    return { id: 'bronze', label: 'Bronze' };
  }
  function tierBadgeHtml(points) {
    const t = tierFor(points);
    return `<span class="tier-pill tier-pill--${t.id}">${t.label}</span>`;
  }

  // Animate a number ticker — count from current to target value
  function tickNumber(el, fromVal, toVal, duration = 1000) {
    if (!el) return;
    const start = performance.now();
    const diff = toVal - fromVal;
    function step(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(fromVal + diff * eased);
      el.textContent = fmtNum(v);
      if (t < 1) requestAnimationFrame(step);
      else {
        el.textContent = fmtNum(toVal);
        el.classList.add('tickerPop');
        setTimeout(() => el.classList.remove('tickerPop'), 700);
      }
    }
    requestAnimationFrame(step);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtAgo(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const now = Date.now();
    const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'gerade';
    if (days < 1) return 'heute';
    if (days < 2) return 'gestern';
    if (days < 7) return `vor ${days} T.`;
    if (days < 30) return `vor ${Math.floor(days / 7)} W.`;
    if (days < 365) return `vor ${Math.floor(days / 30)} Mon.`;
    return `vor ${Math.floor(days / 365)} J.`;
  }
  function initials(name) {
    return name.split(/\s+/).map(s => s[0] || '').slice(0, 2).join('').toUpperCase();
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }
  // Available avatar colors (must match CSS palette)
  const AVATAR_PALETTE = [
    { id: 'cobalt', bg: '#1E40FF', fg: '#FFF' },
    { id: 'violet', bg: '#7C3AED', fg: '#FFF' },
    { id: 'sky',    bg: '#0EA5E9', fg: '#FFF' },
    { id: 'emerald',bg: '#10B981', fg: '#FFF' },
    { id: 'amber',  bg: '#F59E0B', fg: '#0A0A0A' },
    { id: 'rose',   bg: '#E11D48', fg: '#FFF' },
    { id: 'slate',  bg: '#0F172A', fg: '#FFF' },
    { id: 'teal',   bg: '#0891B2', fg: '#FFF' },
  ];
  function userAvatarColor(u) {
    if (!u) return D.avatarColor('?');
    if (u.avatarColor && u.avatarColor !== 'auto') {
      const found = AVATAR_PALETTE.find(p => p.id === u.avatarColor);
      if (found) return found;
    }
    return D.avatarColor(u.name);
  }
  function avatarHtml(name, size, customColor) {
    const c = customColor || D.avatarColor(name);
    const cls = size ? ` avatar--${size}` : '';
    return `<div class="avatar${cls}" style="background:${c.bg};color:${c.fg}">${initials(name)}</div>`;
  }
  function renderColorPicker(target, currentValue) {
    const el = $(`[data-bind="${target}"]`);
    if (!el) return;
    const swatches = [
      `<li class="color-swatch color-swatch--auto ${currentValue === 'auto' ? 'color-swatch--active' : ''}" data-color="auto" title="Auto"><span class="color-swatch__check">✓</span></li>`,
      ...AVATAR_PALETTE.map(p => `
        <li class="color-swatch ${currentValue === p.id ? 'color-swatch--active' : ''}" data-color="${p.id}" style="background:${p.bg}" title="${p.id}">
          <span class="color-swatch__check" style="color:${p.fg}">✓</span>
        </li>
      `),
    ];
    el.innerHTML = swatches.join('');
  }
  function categoryIcon(catId) {
    const c = D.CATEGORIES.find(x => x.id === catId);
    return c ? c.icon : '·';
  }
  function categoryLabel(catId) {
    const c = D.CATEGORIES.find(x => x.id === catId);
    return c ? c.label : catId;
  }
  function trophyCatLabel(cat) {
    return ({ auto: 'Auto', watch: 'Uhr', invest: 'Investment', business: 'Business', other: 'Sonstiges' })[cat] || 'Item';
  }

  /* ─── routing ─── */
  function go(view, opts = {}) {
    const prev = document.body.dataset.view;
    if (!opts.skipHistory) state.history.push(view);
    document.body.dataset.view = view;
    $$('.view').forEach(v => v.hidden = (v.dataset.view !== view));
    if (prev && prev !== view && prev !== 'loading' && !opts.silent) soundTap();
    const tabbar = $('[data-tabbar]');
    if (['home', 'feed', 'leaderboard', 'profile', 'stats', 'history', 'map', 'squad'].includes(view)) {
      tabbar.hidden = false;
    } else {
      tabbar.hidden = true;
    }
    $$('.tabbar__link').forEach(l => l.classList.toggle('tabbar__link--active', l.dataset.route === view));
    window.scrollTo(0, 0);
    render();
  }
  function back() {
    if (state.history.length > 1) {
      state.history.pop();
      const prev = state.history[state.history.length - 1];
      go(prev, { skipHistory: true });
    } else {
      go('home', { skipHistory: true });
    }
  }

  /* ─── TUTORIAL ─── */
  const TUTORIAL_STEPS = [
    {
      target: '.profile-card',
      title: 'Dein Score',
      text: 'Punkte sammelst du durch echte Achievements. Friends bestätigen, du steigst im Ranking.',
    },
    {
      target: '[data-bind-section="suggestions"]',
      title: 'Nächste Wins',
      text: 'Hier siehst du deine empfohlenen nächsten Achievements. Tap drauf, einer deiner Freunde bestätigt, +Punkte.',
      fallback: '.fab',
    },
    {
      target: '[data-bind-section="challenges"]',
      title: 'Challenges',
      text: 'Battle 1-vs-1 mit Freunden. Sieger kriegt 1.000 Punkte, Verlierer zahlt 1.000 ab. Auto-resolved.',
    },
    {
      target: '.tabbar__link[data-route="feed"]',
      title: 'Feed',
      text: 'Was deine Freunde gerade geclaimt haben — mit Reactions und Foto-Beweisen.',
    },
    {
      target: '.tabbar__link[data-route="leaderboard"]',
      title: 'Ranking',
      text: 'Friend-Group + Stadt-Top-100. Filter nach Kategorie. Dein Ziel: Platz 1.',
    },
  ];

  function startTutorial() {
    if (localStorage.getItem('ranked.tutorial.done') === '1') return;
    state.tutorialStep = 0;
    showTutorialStep();
  }

  function showTutorialStep() {
    const step = TUTORIAL_STEPS[state.tutorialStep];
    if (!step) { finishTutorial(); return; }
    const overlay = $('[data-tutorial]');
    if (!overlay) return;
    overlay.hidden = false;

    const total = TUTORIAL_STEPS.length;
    const stepEl = $('[data-tutorial-step]');
    const totalEl = $('[data-tutorial-total]');
    if (stepEl) stepEl.textContent = state.tutorialStep + 1;
    if (totalEl) totalEl.textContent = total;
    setText('tutorial-title', step.title);
    const tEl = $('[data-tutorial-title]'); if (tEl) tEl.textContent = step.title;
    const xEl = $('[data-tutorial-text]');  if (xEl) xEl.textContent = step.text;

    let target = document.querySelector(step.target);
    if (!target || target.hidden || target.offsetWidth === 0) {
      target = step.fallback ? document.querySelector(step.fallback) : null;
    }
    if (!target || target.offsetWidth === 0) {
      state.tutorialStep++;
      showTutorialStep();
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => positionTutorialSpotlight(target), 250);
  }

  function positionTutorialSpotlight(target) {
    const overlay = $('[data-tutorial]');
    const spotlight = $('[data-tutorial-spotlight]');
    const bubble = $('[data-tutorial-bubble]');
    if (!overlay || !spotlight || !bubble) return;

    const r = target.getBoundingClientRect();
    const pad = 8;
    spotlight.style.top    = (r.top - pad) + 'px';
    spotlight.style.left   = (r.left - pad) + 'px';
    spotlight.style.width  = (r.width + pad * 2) + 'px';
    spotlight.style.height = (r.height + pad * 2) + 'px';

    // place bubble below or above
    const vh = window.innerHeight;
    const bw = 360;
    const bx = Math.max(16, Math.min(window.innerWidth - bw - 16, r.left + r.width / 2 - bw / 2));
    let by = r.bottom + 16;
    if (by + 200 > vh) by = r.top - 200;
    bubble.style.top  = by + 'px';
    bubble.style.left = bx + 'px';
  }

  function nextTutorial() {
    state.tutorialStep++;
    if (state.tutorialStep >= TUTORIAL_STEPS.length) finishTutorial();
    else showTutorialStep();
  }

  function finishTutorial() {
    localStorage.setItem('ranked.tutorial.done', '1');
    const overlay = $('[data-tutorial]');
    if (overlay) overlay.hidden = true;
  }

  /* ─── sound (Web Audio synthesized) ─── */
  let _audioCtx = null;
  function audioCtx() {
    if (_audioCtx) return _audioCtx;
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { _audioCtx = null; }
    return _audioCtx;
  }
  function isSoundEnabled() {
    return localStorage.getItem('ranked.sound.off') !== '1';
  }
  function playTone(freq, dur = 0.12, type = 'sine', vol = 0.18) {
    if (!isSoundEnabled()) return;
    const ctx = audioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }
  function soundAchievement(points = 0) {
    // tier-based chords for max wow
    const tier = tierFor(points).id;
    const chord = ({
      bronze: [392.00, 493.88, 587.33],         // G4, B4, D5
      silver: [523.25, 659.25, 783.99],         // C5, E5, G5
      gold:   [523.25, 659.25, 783.99, 1046.5], // + C6
      plat:   [523.25, 659.25, 783.99, 1046.5, 1318.5],
      legend: [659.25, 783.99, 987.77, 1318.5, 1568, 1976], // big arpeggio
    })[tier] || [523.25, 659.25, 783.99];
    chord.forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'triangle', 0.18), i * 70));
  }
  function soundTap()      { playTone(880, 0.06, 'sine', 0.12); }
  function soundReaction() { playTone(1318.5, 0.1, 'triangle', 0.15); }
  function soundOpen()     { playTone(440, 0.08, 'sine', 0.1); setTimeout(() => playTone(660, 0.06, 'sine', 0.08), 60); }
  function soundError()    { playTone(220, 0.12, 'sawtooth', 0.12); }
  function soundLevelup()  {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.12, 'triangle', 0.18), i * 80));
  }

  /* ─── confetti + haptic ─── */
  function vibrate(pattern) {
    if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {}
  }
  function confetti() {
    const canvas = $('[data-confetti]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const colors = ['#C5F12B', '#FF3B30', '#F2A900', '#0E0D0A', '#DBFF60', '#FF5C52'];
    const shapes = ['rect', 'circle', 'streamer', 'star'];
    const N = 130;
    const parts = [];
    for (let i = 0; i < N; i++) {
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      parts.push({
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h * 0.45,
        vx: (Math.random() - 0.5) * 12,
        vy: -12 - Math.random() * 10,
        g: 0.28 + Math.random() * 0.18,
        size: shape === 'streamer' ? 18 + Math.random() * 12 : 5 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.5,
        shape,
        life: 1,
      });
    }
    let raf;
    const start = performance.now();
    const dur = 2200;

    function drawStar(ctx, size) {
      ctx.beginPath();
      const spikes = 5;
      const outer = size / 2;
      const inner = outer / 2.4;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#0E0D0A';
      ctx.stroke();
    }

    function frame(now) {
      const elapsed = now - start;
      const remaining = Math.max(0, 1 - elapsed / dur);
      ctx.clearRect(0, 0, w, h);
      parts.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g;
        p.rot += p.vRot;
        p.vx *= 0.99;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = remaining;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.shape === 'streamer') {
          // long thin ribbon
          ctx.fillRect(-p.size / 2, -2, p.size, 4);
        } else if (p.shape === 'star') {
          drawStar(ctx, p.size * 1.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      if (elapsed < dur) raf = requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, w, h); }
    }
    raf = requestAnimationFrame(frame);
  }

  /* ─── toast ─── */
  function toast(msg) {
    const el = $('[data-toast]');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('toast--show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.classList.remove('toast--show');
      setTimeout(() => el.hidden = true, 320);
    }, 2400);
  }

  /* ─── render ─── */
  function render() {
    const v = document.body.dataset.view;
    if (v === 'home') renderHome();
    if (v === 'feed') renderFeed();
    if (v === 'leaderboard') renderLeaderboard();
    if (v === 'profile') renderProfile();
    if (v === 'stats') renderStats();
    if (v === 'history') renderHistory();
    if (v === 'map') renderMap();
    if (v === 'squad') renderSquadDetail();
    refreshNotifBadge();
  }

  function renderHome() {
    const u = state.user;
    if (!u) return;

    // resolve challenges first so score reflects bonus points
    resolveChallenges();

    setText('user.name', u.name);
    setText('user.city', u.city);
    const newScore = userScore(u);
    const scoreEl = $('[data-bind="user.score"]');
    if (scoreEl) {
      const oldScore = state.lastScore;
      if (oldScore != null && oldScore !== newScore) {
        tickNumber(scoreEl, oldScore, newScore, 1100);
      } else {
        scoreEl.textContent = fmtNum(newScore);
      }
      state.lastScore = newScore;
    }
    setText('user.achCount', `${(u.achievements || []).length} insgesamt`);

    // bio + goal
    const bioEl = $('[data-bind="user.bio"]');
    if (bioEl) {
      if (u.bio && u.bio.trim()) {
        bioEl.hidden = false;
        bioEl.textContent = `"${u.bio.trim()}"`;
      } else {
        bioEl.hidden = true;
      }
    }
    const goalEl = $('[data-bind="user.goal"]');
    if (goalEl) {
      if (u.goal && u.goal.trim()) {
        goalEl.hidden = false;
        const gt = $('[data-bind="user.goalText"]');
        if (gt) gt.textContent = u.goal.trim();
      } else {
        goalEl.hidden = true;
      }
    }
    const avatarEl = $('[data-bind="user.avatar"]');
    if (avatarEl) {
      const c = userAvatarColor(u);
      avatarEl.style.background = c.bg;
      avatarEl.style.color = c.fg;
      avatarEl.textContent = initials(u.name);
    }

    setText('rank.friends', myFriendRank() || '—');
    setText('total.friends', myFriendTotal());
    setText('rank.city', myCityRank());

    // bonus from challenges
    const bonus = u.bonusPoints || 0;
    const bonusEl = $('[data-bind="user.bonus"]');
    if (bonusEl) {
      if (bonus !== 0) {
        bonusEl.hidden = false;
        bonusEl.textContent = `${bonus > 0 ? '+' : ''}${fmtNum(bonus)} Bonus`;
        bonusEl.classList.toggle('profile-card__bonus--neg', bonus < 0);
      } else {
        bonusEl.hidden = true;
      }
    }

    // streak card — best active streak achievement (the user has the most-recent streak achievement)
    const streakEl = $('[data-bind-section="streak"]');
    if (streakEl) {
      const streakAchs = (u.achievements || [])
        .map(a => ({ ach: a, def: findAchievementAny(a.id) }))
        .filter(x => x.def && x.def.cat === 'streaks')
        .sort((a, b) => (b.ach.date || '').localeCompare(a.ach.date || ''));
      if (streakAchs.length > 0) {
        const top = streakAchs[0];
        // approximate days from title (extract first number)
        const m = top.def.title.match(/(\d+)/);
        const days = m ? m[1] : '—';
        streakEl.hidden = false;
        setText('streak.days', days);
        setText('streak.chip', top.def.title.replace(/\s*\d+\s*Tage\s*/, '').trim() || 'aktiv');
      } else {
        streakEl.hidden = true;
      }
    }

    // categories
    const points = userCategoryPoints(u);
    const counts = userCategoryCount(u);
    const catEl = $('[data-bind="categories"]');
    catEl.innerHTML = D.CATEGORIES.map(c => `
      <li class="cat" data-cat="${c.id}">
        <span class="cat__icon">${c.icon}</span>
        <span class="cat__name">${c.label}</span>
        <span class="cat__points">${fmtNum(points[c.id])}</span>
        <span class="cat__count">${counts[c.id]} Achievement${counts[c.id] === 1 ? '' : 's'}</span>
      </li>
    `).join('');

    // trophies
    const trophyEl = $('[data-bind="trophies"]');
    if (!u.trophies || u.trophies.length === 0) {
      trophyEl.innerHTML = `<li class="trophy trophy--empty">Trag dein Auto, deine Uhr oder dein Investment ein — Showcase, 0 Punkte.</li>`;
    } else {
      trophyEl.innerHTML = u.trophies.map(t => `
        <li class="trophy">
          <span class="trophy__cat">${trophyCatLabel(t.cat)}</span>
          <span class="trophy__label">${escapeHtml(t.label)}</span>
          ${t.detail ? `<span class="trophy__detail">${escapeHtml(t.detail)}</span>` : ''}
        </li>
      `).join('');
    }

    // goal banner (only for users still under thresholds)
    renderGoalBanner();

    // suggestions
    renderSuggestions();

    // goals
    renderGoalsList();

    // squads
    renderSquadsHome();

    // challenges (already resolved at top of renderHome)
    renderChallengesUI();

    // own feed
    const feedEl = $('[data-bind="ownFeed"]');
    if (!u.achievements || u.achievements.length === 0) {
      feedEl.innerHTML = `
        <li class="ach-feed__empty">
          <div class="ach-feed__empty-icon">★</div>
          <div class="ach-feed__empty-title">Noch keine Achievements</div>
          <div class="ach-feed__empty-text">Hau das erste raus — tap auf den blauen Achievement-Button unten rechts. Friends bestätigen, du sammelst Punkte.</div>
        </li>`;
    } else {
      const recent = u.achievements.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      feedEl.innerHTML = recent.map(ach => {
        const def = findAchievementAny(ach.id);
        if (!def) return '';
        return `
          <li class="ach-item" data-ach-id="${ach.id}">
            <span class="ach-item__icon">${categoryIcon(def.cat)}</span>
            <div class="ach-item__main">
              <div class="ach-item__title">${escapeHtml(def.title)} ${tierBadgeHtml(def.points)}</div>
              <div class="ach-item__meta">
                <span>${fmtAgo(ach.date)}</span>
                <span>·</span>
                <span class="ach-item__verified ${ach.cityVerified ? '' : 'ach-item__verified--friend'}">
                  ${ach.cityVerified ? '✓ Stadt' : '✓ Friend'}
                </span>
                ${(ach.friendReactions && ach.friendReactions.length > 0) ? `<span>· ${ach.friendReactions.length} ❤</span>` : ''}
              </div>
            </div>
            <span class="ach-item__points">+${fmtNum(def.points)}</span>
          </li>
        `;
      }).join('');
    }
  }

  function renderFeed() {
    if (!state.activityStream) state.activityStream = D.buildActivityStream();
    const stream = state.activityStream;

    // Stories bar (latest activity per friend within last 14 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const latestPerFriend = {};
    stream.forEach(item => {
      if (item.date < cutoffISO) return;
      if (!latestPerFriend[item.friendId] || latestPerFriend[item.friendId].date < item.date) {
        latestPerFriend[item.friendId] = item;
      }
    });
    const storiesEl = $('[data-bind="stories"]');
    if (storiesEl) {
      const myAvatar = state.user ? avatarHtml(state.user.name) : '';
      const stories = Object.values(latestPerFriend).sort((a, b) => b.date.localeCompare(a.date));
      const seen = state.reactions || {};
      const cards = stories.map(item => {
        const c = D.avatarColor(item.friend.name);
        const wasSeen = !!seen[item.id];
        return `
          <li class="story" data-profile-id="${item.friendId}">
            <div class="story__ring ${wasSeen ? 'story__ring--seen' : ''}">
              <div class="story__inner">
                <div class="story__avatar" style="background:${c.bg};color:${c.fg}">${initials(item.friend.name)}</div>
              </div>
            </div>
            <span class="story__name">${escapeHtml(item.friend.name.split(' ')[0])}</span>
          </li>
        `;
      }).join('');
      const myCard = state.user ? `
        <li class="story" data-action="open-add-achievement">
          <div class="story__add">+</div>
          <span class="story__name story__name--me">Dein Win</span>
        </li>
      ` : '';
      storiesEl.innerHTML = myCard + cards;
    }

    const el = $('[data-bind="activity"]');
    if (stream.length === 0) {
      el.innerHTML = `
        <li class="ach-feed__empty">
          <div class="ach-feed__empty-icon">◐</div>
          <div class="ach-feed__empty-title">Keine Aktivität</div>
          <div class="ach-feed__empty-text">Sobald deine Freunde Achievements claimen, erscheinen sie hier. Tap die Lupe oben rechts um Freunde zu finden.</div>
        </li>`;
      return;
    }
    // also splice in user's own recent achievements at top
    const ownRecent = (state.user.achievements || [])
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 3)
      .map(ach => {
        const def = findAchievementAny(ach.id);
        if (!def) return null;
        return {
          id: 'own.' + ach.id,
          friendId: 'me',
          friend: { name: state.user.name + ' (Du)', city: state.user.city, id: 'me' },
          achievement: def,
          date: ach.date,
          cityVerified: ach.cityVerified,
          photoId: ach.photoId || null,
          reactions: { fire: (ach.friendReactions||[]).filter(r => r.kind==='fire').length, heart: (ach.friendReactions||[]).filter(r => r.kind==='heart').length, clap: (ach.friendReactions||[]).filter(r => r.kind==='clap').length },
          comments: 0,
          isOwn: true,
        };
      }).filter(Boolean);

    const combined = [...ownRecent, ...stream].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const html = combined.slice(0, 30).map((item, idx) => {
      const f = item.friend;
      const def = item.achievement;
      const myReact = state.reactions[item.id] || {};
      const fireCount = item.reactions.fire + (myReact.fire ? 1 : 0);
      const heartCount = item.reactions.heart + (myReact.heart ? 1 : 0);
      const clapCount = item.reactions.clap + (myReact.clap ? 1 : 0);
      // photo: real for own items with photoId, mock for friends' verified items
      const hasRealPhoto = item.isOwn && item.photoId;
      const showPhoto = hasRealPhoto || (item.cityVerified && (idx % 2 === 0));
      const gradientNum = ((item.id.charCodeAt(0) || 0) % 5) + 1;
      const photoTag = ({
        finanzen: '€ Stadt-verifiziert',
        fitness:  '⊹ Stadt-verifiziert',
        skills:   '◇ Stadt-verifiziert',
        streaks:  '↻ Stadt-verifiziert',
      })[def.cat] || '✓ Stadt-verifiziert';

      return `
        <li class="activity-card" data-profile-id="${f.id}">
          <div class="activity-card__head">
            ${avatarHtml(f.name)}
            <div class="activity-card__user">
              <div class="activity-card__name">${escapeHtml(f.name)}</div>
              <div class="activity-card__when">${fmtAgo(item.date)} · ${escapeHtml(f.city)}</div>
            </div>
            ${item.cityVerified ? '<span class="activity-card__verified">✓ verifiziert</span>' : ''}
          </div>

          ${showPhoto ? `
            <div class="activity-card__photo activity-card__photo--gradient-${gradientNum}" ${hasRealPhoto ? `data-photo-id="${item.photoId}"` : ''}>
              <span class="activity-card__photo-tag">${photoTag}</span>
            </div>
          ` : ''}

          <div class="activity-card__body" data-cat="${def.cat}">
            <span class="activity-card__icon">${categoryIcon(def.cat)}</span>
            <span class="activity-card__title">${escapeHtml(def.title)}</span>
            <span class="activity-card__points">+${fmtNum(def.points)}</span>
          </div>

          <div class="activity-card__foot" data-activity-id="${item.id}">
            <button class="reaction ${myReact.fire ? 'reaction--active' : ''}" data-react="fire" type="button">🔥 <span class="reaction__count">${fireCount}</span></button>
            <button class="reaction ${myReact.heart ? 'reaction--active' : ''}" data-react="heart" type="button">❤️ <span class="reaction__count">${heartCount}</span></button>
            <button class="reaction ${myReact.clap ? 'reaction--active' : ''}" data-react="clap" type="button">👏 <span class="reaction__count">${clapCount}</span></button>
            <span class="activity-card__comment" style="cursor: pointer;">💬 ${item.comments || (state.comments && state.comments[item.id] && state.comments[item.id].length) || 0}</span>
          </div>
        </li>
      `;
    }).join('');
    el.innerHTML = html;

    // load real photos asynchronously
    el.querySelectorAll('[data-photo-id]').forEach(node => {
      const pid = node.dataset.photoId;
      if (!pid) return;
      getPhotoUrl(pid).then(url => {
        if (url) {
          node.style.background = `url("${url}") center / cover no-repeat`;
        }
      });
    });
  }

  function renderLeaderboard() {
    $$('.seg__btn').forEach(t => {
      if (t.dataset.tab) t.classList.toggle('seg__btn--active', t.dataset.tab === state.activeTab);
    });

    // filter chips
    const filterEl = $('[data-bind="filterChips"]');
    const filters = [{ id: 'all', label: 'Gesamt' }, ...D.CATEGORIES];
    filterEl.innerHTML = filters.map(f => `
      <button class="chip ${state.activeFilter === f.id ? 'chip--active' : ''}" data-filter="${f.id}" type="button">
        ${f.icon ? f.icon + ' ' : ''}${f.label}
      </button>
    `).join('');

    const list = state.activeTab === 'friends' ? friendsRanking() : cityRanking();
    const board = $('[data-bind="board"]');
    board.innerHTML = list.map((u, i) => {
      const rank = i + 1;
      const isMe = u.isMe;
      const cls = `${isMe ? 'board__row--me' : ''} ${rank === 1 ? 'board__row--top1' : ''} ${rank <= 3 ? 'board__row--top3' : ''}`;
      const cleanName = u.name.replace(' (Du)', '');
      const color = isMe ? userAvatarColor(state.user) : null;
      return `
        <li class="board__row ${cls}" data-profile-id="${u.id}">
          <span class="board__rank-num">${rank}</span>
          ${avatarHtml(cleanName, 'sm', color)}
          <div class="board__name">
            <div class="board__name-text">${escapeHtml(u.name)}</div>
            <div class="board__sub">${escapeHtml(u.city || '')}</div>
          </div>
          <span class="board__score">${fmtNum(filterScore(u))}</span>
        </li>
      `;
    }).join('');
  }

  function renderProfile() {
    const id = state.profileViewing;
    if (!id) return;
    const ranking = state.activeTab === 'friends' ? friendsRanking() : cityRanking();
    let u = ranking.find(x => x.id === id);
    if (!u) u = D.FRIENDS.find(x => x.id === id) || D.CITY_USERS.find(x => x.id === id);
    if (!u) return;

    setText('other.name', u.name.replace(' (Du)', ''));
    setText('other.city', u.city || '');
    setText('other.score', fmtNum(u.score));
    setText('other.cityRank', u.cityRank || '—');
    setText('other.achCount', `${(u.achievements || []).length} insgesamt`);

    // bio + goal for other (only my own real user has bio; mocks could too — show if present)
    const oBio = $('[data-bind="other.bio"]');
    if (oBio) {
      if (u.bio && u.bio.trim()) { oBio.hidden = false; oBio.textContent = `"${u.bio.trim()}"`; }
      else oBio.hidden = true;
    }
    const oGoal = $('[data-bind="other.goal"]');
    if (oGoal) {
      if (u.goal && u.goal.trim()) {
        oGoal.hidden = false;
        const gt = $('[data-bind="other.goalText"]'); if (gt) gt.textContent = u.goal.trim();
      } else oGoal.hidden = true;
    }

    const avatarEl = $('[data-bind="other.avatar"]');
    if (avatarEl) {
      const c = D.avatarColor(u.name);
      avatarEl.style.background = c.bg;
      avatarEl.style.color = c.fg;
      avatarEl.textContent = initials(u.name);
    }

    const points = u.categoryPoints || { finanzen: 0, fitness: 0, skills: 0, streaks: 0 };
    const catEl = $('[data-bind="other.categories"]');
    catEl.innerHTML = D.CATEGORIES.map(c => `
      <li class="cat" data-cat="${c.id}">
        <span class="cat__icon">${c.icon}</span>
        <span class="cat__name">${c.label}</span>
        <span class="cat__points">${fmtNum(points[c.id] || 0)}</span>
      </li>
    `).join('');

    const trophyEl = $('[data-bind="other.trophies"]');
    if (!u.trophies || u.trophies.length === 0) {
      trophyEl.innerHTML = `<li class="trophy trophy--empty">Keine Trophies bisher.</li>`;
    } else {
      trophyEl.innerHTML = u.trophies.map(t => `
        <li class="trophy">
          <span class="trophy__cat">${trophyCatLabel(t.cat)}</span>
          <span class="trophy__label">${escapeHtml(t.label)}</span>
          ${t.detail ? `<span class="trophy__detail">${escapeHtml(t.detail)}</span>` : ''}
        </li>
      `).join('');
    }

    const feedEl = $('[data-bind="other.feed"]');
    if (!u.achievements || u.achievements.length === 0) {
      feedEl.innerHTML = `<li class="ach-feed__empty">Keine Achievements.</li>`;
    } else {
      const recent = u.achievements.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      feedEl.innerHTML = recent.map(ach => {
        const def = findAchievementAny(ach.id);
        if (!def) return '';
        return `
          <li class="ach-item" data-ach-id="${ach.id}">
            <span class="ach-item__icon">${categoryIcon(def.cat)}</span>
            <div class="ach-item__main">
              <div class="ach-item__title">${escapeHtml(def.title)}</div>
              <div class="ach-item__meta">
                <span>${fmtAgo(ach.date)}</span>
                <span>·</span>
                <span class="ach-item__verified">✓ Stadt-verifiziert</span>
              </div>
            </div>
            <span class="ach-item__points">+${fmtNum(def.points)}</span>
          </li>
        `;
      }).join('');
    }
  }

  /* ─── challenges ─── */
  function resolveChallenges() {
    if (!state.challenges) state.challenges = loadChallenges();
    let changed = false;
    const today = new Date().toISOString().slice(0, 10);

    state.challenges.forEach(ch => {
      if (['won', 'lost', 'declined', 'expired'].includes(ch.status)) return;
      const userHas = (state.user.achievements || []).find(a => a.id === ch.achievementId);

      if (userHas && (ch.status === 'active' || ch.status === 'pending')) {
        ch.status = 'won';
        ch.resolvedAt = today;
        state.user.bonusPoints = (state.user.bonusPoints || 0) + D.CHALLENGE_STAKE;
        changed = true;
      } else if (ch.status === 'active' && ch.deadline && ch.deadline < today) {
        ch.status = 'lost';
        ch.resolvedAt = today;
        state.user.bonusPoints = (state.user.bonusPoints || 0) - D.CHALLENGE_STAKE;
        changed = true;
      } else if (ch.status === 'pending' && ch.deadline && ch.deadline < today) {
        // unaccepted past deadline = expired (no point change)
        ch.status = 'expired';
        ch.resolvedAt = today;
        changed = true;
      }
    });

    if (changed) {
      saveUser();
      saveChallenges();
    }
  }

  function renderChallengesUI() {
    const el = $('[data-bind="challenges"]');
    if (!el) return;

    if (state.challenges.length === 0) {
      el.innerHTML = '';
      return;
    }

    // sort: pending first, then active, then resolved
    const order = { pending: 0, active: 1, won: 2, lost: 3, declined: 4 };
    const sorted = state.challenges.slice().sort((a, b) => order[a.status] - order[b.status]);

    el.innerHTML = sorted.map(ch => {
      const fromFriend = ch.from === 'me' ? state.user : (D.findFriend(ch.from) || friendsList().find(f => f.id === ch.from));
      const toFriend   = ch.to   === 'me' ? state.user : (D.findFriend(ch.to)   || friendsList().find(f => f.id === ch.to));
      if (!fromFriend || !toFriend) return '';
      const def = findAchievementAny(ch.achievementId);
      if (!def) return '';

      const incoming = ch.to === 'me' && ch.status === 'pending';
      const outgoing = ch.from === 'me';
      const fromName = ch.from === 'me' ? 'Du' : fromFriend.name;
      const toName = ch.to === 'me' ? 'dich' : toFriend.name;

      const statusLabel = ({
        pending: incoming ? 'Eingegangen' : 'Ausstehend',
        active: 'Läuft',
        won: '🏆 Gewonnen',
        lost: 'Verloren',
        declined: 'Abgelehnt',
        expired: 'Abgelaufen',
      })[ch.status] || ch.status;

      const stakeNote = ch.status === 'won' ? '+1.000 dazu'
                      : ch.status === 'lost' ? '–1.000 weg'
                      : '1.000 Punkte';

      let actions = '';
      if (incoming) {
        actions = `
          <div class="challenge__actions">
            <button class="btn btn--ghost btn--sm" type="button" data-challenge-action="decline" data-challenge-id="${ch.id}">Ablehnen</button>
            <button class="btn btn--primary btn--sm" type="button" data-challenge-action="accept" data-challenge-id="${ch.id}">Annehmen</button>
          </div>
        `;
      }

      return `
        <li class="challenge challenge--${ch.status}" data-challenge-id="${ch.id}">
          <div class="challenge__head">
            ${avatarHtml(fromName === 'Du' ? state.user.name : fromFriend.name, 'sm')}
            <div class="challenge__from">
              <div class="challenge__title-row">
                <span class="challenge__name">${escapeHtml(fromName)}</span>
                <span class="challenge__arrow">→</span>
                <span class="challenge__name">${escapeHtml(toName)}</span>
              </div>
              <div class="challenge__sub">Frist: ${fmtDate(ch.deadline)}</div>
            </div>
            <span class="challenge__status challenge__status--${ch.status}">${statusLabel}</span>
          </div>

          <div class="challenge__body">
            <div class="challenge__ach">
              <span class="challenge__ach-icon">${categoryIcon(def.cat)}</span>
              <span>${escapeHtml(def.title)}</span>
              <span class="challenge__points">+${fmtNum(def.points)}</span>
            </div>
            <div class="challenge__stake">
              <span class="challenge__stake-label">Einsatz</span>
              <span class="challenge__stake-amount">${stakeNote}</span>
            </div>
          </div>

          ${actions}
        </li>
      `;
    }).join('');
  }

  function acceptChallenge(id) {
    const ch = state.challenges.find(c => c.id === id);
    if (!ch) return;
    ch.status = 'active';
    saveChallenges();
    render();
    toast('Challenge angenommen — leg los');
  }
  function declineChallenge(id) {
    const ch = state.challenges.find(c => c.id === id);
    if (!ch) return;
    ch.status = 'declined';
    saveChallenges();
    render();
    toast('Challenge abgelehnt');
  }

  function openCreateChallenge() {
    const m = $('#create-challenge-modal');
    const friendSel = $('[data-bind-id="ch-friend-select"]');
    const achSel = $('[data-bind-id="ch-ach-select"]');
    friendSel.innerHTML = friendsList().map(f =>
      `<option value="${f.id}">${escapeHtml(f.name)}</option>`
    ).join('');
    // group achievements by category for clarity
    const byCat = {};
    D.ACHIEVEMENTS.forEach(a => { (byCat[a.cat] = byCat[a.cat] || []).push(a); });
    achSel.innerHTML = D.CATEGORIES.map(c => {
      const items = byCat[c.id] || [];
      return `<optgroup label="${escapeHtml(c.label)}">` +
        items.map(a => `<option value="${a.id}">${escapeHtml(a.title)} — +${fmtNum(a.points)}</option>`).join('') +
        `</optgroup>`;
    }).join('');

    // set default deadline to +30 days
    const dInput = m.querySelector('input[name="chDeadline"]');
    const d = new Date(); d.setDate(d.getDate() + 30);
    dInput.value = d.toISOString().slice(0, 10);

    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  function commitCreateChallenge(form) {
    const fd = new FormData(form);
    const ch = {
      id: 'ch.user.' + Date.now(),
      from: 'me',
      to: fd.get('chFriend'),
      achievementId: fd.get('chAchievement'),
      deadline: fd.get('chDeadline'),
      status: 'active',  // outgoing challenges auto-active (assume friend accepts)
      createdAt: new Date().toISOString().slice(0, 10),
    };
    if (!state.challenges) state.challenges = loadChallenges();
    state.challenges.push(ch);
    saveChallenges();
    closeAllModals();
    toast('Challenge gesendet — 1.000 Punkte stehen auf dem Spiel');
    render();
  }

  /* ─── share-card modal ─── */
  function openShareCard(achievementId) {
    const def = findAchievementAny(achievementId);
    if (!def) return;
    const u = state.user;

    setText('share.title', def.title);
    setText('share.cat', categoryLabel(def.cat));
    setText('share.points', fmtNum(def.points));
    setText('share.icon', categoryIcon(def.cat));
    setText('share.name', u.name);
    setText('share.city', u.city);
    setText('share.rank', myCityRank());
    setText('share.date', new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }));
    const av = $('[data-bind="share.avatar"]');
    if (av) {
      const c = userAvatarColor(u);
      av.style.background = c.bg; av.style.color = c.fg;
      av.textContent = initials(u.name);
    }

    state.lastShare = { achievementId, achievement: def };

    const m = $('#share-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  async function shareAchievement() {
    if (!state.lastShare) return;
    const def = state.lastShare.achievement;
    const u = state.user;
    const text = `🔥 Neues Achievement auf Ranked: "${def.title}" — +${fmtNum(def.points)} Punkte. ${u.name} aus ${u.city}, #${myCityRank()} der Stadt.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ranked', text });
        toast('Geteilt');
      } catch (e) {
        // user cancelled — silent
      }
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        toast('Text kopiert');
      } catch (e) {
        toast('Konnte nicht kopieren');
      }
    } else {
      toast('Screenshot machen!');
    }
  }

  /* ─── DATA EXPORT / IMPORT ─── */
  function exportData() {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      user: state.user,
      challenges: state.challenges,
      reactions: state.reactions,
      squads: state.squads,
      comments: state.comments,
      tutorialDone: localStorage.getItem('ranked.tutorial.done') === '1',
      theme: localStorage.getItem('ranked.theme') || 'auto',
      sound: localStorage.getItem('ranked.sound.off') !== '1',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranked-${(state.user?.name || 'profil').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Daten exportiert');
  }
  async function importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !data.user) throw new Error('Invalid file');
      state.user = data.user;
      saveUser();
      if (data.challenges) { state.challenges = data.challenges; saveChallenges(); }
      if (data.reactions) { state.reactions = data.reactions; saveReactions(); }
      if (data.squads) { state.squads = data.squads; saveSquads(); }
      if (data.comments) { state.comments = data.comments; saveComments(); }
      if (data.theme) setTheme(data.theme);
      if (data.tutorialDone) localStorage.setItem('ranked.tutorial.done', '1');
      closeAllModals();
      toast('Daten importiert');
      soundLevelup();
      render();
    } catch (e) {
      toast('Import fehlgeschlagen — ungültige Datei');
      soundError();
    }
  }

  /* ─── COMMENTS ─── */
  function loadComments() {
    try { return JSON.parse(localStorage.getItem('ranked.comments') || '{}'); } catch (e) { return {}; }
  }
  function saveComments() {
    localStorage.setItem('ranked.comments', JSON.stringify(state.comments || {}));
  }
  function seedMockComments() {
    if (state.comments && Object.keys(state.comments).length > 0) return;
    state.comments = state.comments || {};
    if (!state.activityStream) state.activityStream = D.buildActivityStream();
    const stream = state.activityStream;
    const mockTexts = [
      ['🔥 Insane!', 'Mach weiter so 💪', 'Wie hast du das geschafft?'],
      ['Damn, beeindruckend', 'Glückwunsch Bro 🎯'],
      ['LFG!', 'Aktuell auf nem ähnlichen Weg, Inspiration', 'Welche Tipps?'],
    ];
    stream.slice(0, 5).forEach((item, idx) => {
      if (Math.random() < 0.5) {
        const friend = D.FRIENDS[Math.floor(Math.random() * D.FRIENDS.length)];
        const texts = mockTexts[idx % mockTexts.length];
        state.comments[item.id] = texts.slice(0, 1 + Math.floor(Math.random() * texts.length)).map((text, i) => ({
          id: `mock.${item.id}.${i}`,
          authorId: D.FRIENDS[(idx + i) % D.FRIENDS.length].id,
          text,
          when: item.date,
        }));
      }
    });
    saveComments();
  }

  function openComments(activityId) {
    state.commentingOn = activityId;
    renderComments();
    const m = $('#comments-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
    setTimeout(() => $('[data-bind-id="comment-input"]').focus(), 100);
  }
  function renderComments() {
    const aid = state.commentingOn;
    if (!aid) return;
    const list = (state.comments && state.comments[aid]) || [];
    const el = $('[data-bind="commentsList"]');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = '<li class="comments__empty">Noch keine Kommentare. Sei der erste.</li>';
      return;
    }
    el.innerHTML = list.map(c => {
      const isMe = c.authorId === 'me';
      const author = isMe ? state.user : (D.findFriend(c.authorId) || friendsList().find(f => f.id === c.authorId));
      if (!author) return '';
      const color = isMe ? userAvatarColor(state.user) : D.avatarColor(author.name);
      return `
        <li class="comment ${isMe ? 'comment--me' : ''}">
          <div class="avatar avatar--sm" style="background:${color.bg};color:${color.fg}">${initials(author.name)}</div>
          <div class="comment__main">
            <div class="comment__head">
              <span class="comment__name">${escapeHtml(author.name)}${isMe ? ' (Du)' : ''}</span>
              <span class="comment__when">${fmtAgo(c.when)}</span>
            </div>
            <div class="comment__bubble">${escapeHtml(c.text)}</div>
          </div>
        </li>
      `;
    }).join('');
  }
  function postComment() {
    const aid = state.commentingOn;
    const input = $('[data-bind-id="comment-input"]');
    if (!aid || !input) return;
    const text = (input.value || '').trim();
    if (!text) return;
    state.comments = state.comments || {};
    if (!state.comments[aid]) state.comments[aid] = [];
    state.comments[aid].push({
      id: 'me.' + Date.now(),
      authorId: 'me',
      text,
      when: new Date().toISOString().slice(0, 10),
    });
    saveComments();
    input.value = '';
    renderComments();
    soundTap();
  }

  /* ─── GOALS LIST ─── */
  function userGoals() {
    return (state.user && state.user.goals) ? state.user.goals : [];
  }
  function renderGoalsList() {
    const u = state.user;
    const list = userGoals();
    const el = $('[data-bind="goalList"]');
    if (!el) return;
    if (list.length === 0) { el.innerHTML = ''; return; }
    const today = new Date().toISOString().slice(0, 10);
    el.innerHTML = list.slice().sort((a, b) => {
      // active first, then by deadline
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.deadline || '').localeCompare(b.deadline || '');
    }).map(g => {
      const overdue = !g.done && g.deadline && g.deadline < today;
      const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date(today)) / (1000 * 60 * 60 * 24)) : null;
      const daysLabel = g.done ? '✓ erledigt' : (overdue ? `${Math.abs(daysLeft)}T überfällig` : (daysLeft != null ? (daysLeft === 0 ? 'heute' : daysLeft + 'T verbleibend') : ''));
      const cat = D.CATEGORIES.find(c => c.id === g.cat);
      const catLabel = cat ? cat.label : 'Sonstiges';
      return `
        <li class="goal-item ${g.done ? 'goal-item--done' : ''} ${overdue ? 'goal-item--overdue' : ''}" data-goal-id="${g.id}">
          <span class="goal-item__check" data-toggle-goal="${g.id}" title="Abhaken">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div class="goal-item__main">
            <div class="goal-item__text">${escapeHtml(g.text)}</div>
            <div class="goal-item__meta">
              <span class="goal-item__cat-pill">${escapeHtml(catLabel)}</span>
              <span>${fmtDate(g.deadline)}</span>
            </div>
          </div>
          <span class="goal-item__days">${escapeHtml(daysLabel)}</span>
          <button class="goal-item__remove" type="button" data-remove-goal="${g.id}" title="Löschen">×</button>
        </li>
      `;
    }).join('');
  }

  function openAddGoal() {
    const m = $('#add-goal-modal');
    const dInput = m.querySelector('input[name="goalDate"]');
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    if (dInput) dInput.value = d.toISOString().slice(0, 10);
    m.querySelector('input[name="goalText"]').value = '';
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  function commitAddGoal(form) {
    const fd = new FormData(form);
    const goal = {
      id: 'g.' + Date.now(),
      text: (fd.get('goalText') || '').toString().trim(),
      deadline: fd.get('goalDate'),
      cat: fd.get('goalCat'),
      createdAt: new Date().toISOString().slice(0, 10),
      done: false,
    };
    if (!goal.text) return;
    if (!state.user.goals) state.user.goals = [];
    state.user.goals.push(goal);
    saveUser();
    closeAllModals();
    toast('Ziel gesetzt');
    soundOpen();
    render();
  }

  function toggleGoalDone(id) {
    const g = (state.user.goals || []).find(x => x.id === id);
    if (!g) return;
    g.done = !g.done;
    if (g.done) g.completedAt = new Date().toISOString().slice(0, 10);
    saveUser();
    if (g.done) { soundLevelup(); vibrate([15, 30, 20]); }
    render();
  }
  function removeGoal(id) {
    if (!state.user.goals) return;
    state.user.goals = state.user.goals.filter(g => g.id !== id);
    saveUser();
    render();
  }

  /* ─── GOAL BANNER ─── */
  const GOAL_TIERS = [
    { threshold: 1000,  title: 'Push deinen Score über 1.000', sub: 'Erste echte Schwelle' },
    { threshold: 5000,  title: 'Knacke die 5.000 Punkte', sub: 'Top-Performer Niveau' },
    { threshold: 10000, title: 'Ziel: 10.000 Punkte', sub: 'Stadt-Elite, Top 30 in Wiesbaden' },
    { threshold: 25000, title: 'Auf zur 25.000', sub: 'Top 5 deiner Stadt erreichbar' },
  ];
  function renderGoalBanner() {
    const u = state.user;
    const score = userScore(u);
    const next = GOAL_TIERS.find(t => score < t.threshold);
    const el = $('[data-bind-section="goal"]');
    if (!el) return;
    if (!next) { el.hidden = true; return; }
    el.hidden = false;
    setText('goal.title', next.title);
    const remaining = next.threshold - score;
    setText('goal.sub', `Noch ${fmtNum(remaining)} Punkte`);
    const prevTier = GOAL_TIERS[GOAL_TIERS.indexOf(next) - 1];
    const base = prevTier ? prevTier.threshold : 0;
    const pct = Math.max(2, Math.min(100, Math.round(((score - base) / (next.threshold - base)) * 100)));
    const bar = $('[data-bind="goal.bar"]');
    if (bar) bar.style.width = pct + '%';
  }

  /* ─── SUGGESTIONS ─── */
  function buildSuggestions() {
    const u = state.user;
    const myIds = new Set((u.achievements || []).map(a => a.id));
    const myCats = userCategoryCount(u);

    // strategy:
    // 1. low-hanging fruit: cheapest unclaimed achievement per category
    // 2. next-tier hint: if user has a tiered fit/fin achievement, suggest the next tier
    // 3. catch-up: category with 0 achievements

    const suggestions = [];

    // next-tier suggestions
    const tieredGroups = {
      bench: ['fit.bench.60','fit.bench.80','fit.bench.100','fit.bench.120','fit.bench.140'],
      squat: ['fit.squat.100','fit.squat.140','fit.squat.180'],
      run5k: ['fit.run.5k.25','fit.run.5k.22','fit.run.5k.20'],
      side:  ['fin.side.100','fin.side.500','fin.side.1k','fin.side.5k','fin.side.10k'],
      save:  ['fin.save.1k','fin.save.5k','fin.save.10k'],
      invest:['fin.invest.first','fin.invest.10k','fin.invest.50k'],
      gymst: ['str.gym.7','str.gym.30','str.gym.100'],
      books: ['skl.book.1','skl.book.10','skl.book.50'],
      foll:  ['soc.followers.1k','soc.followers.10k','soc.followers.100k'],
      country:['tra.country.5','tra.country.10','tra.country.25'],
    };
    for (const [k, ids] of Object.entries(tieredGroups)) {
      const lastDone = ids.findIndex(id => !myIds.has(id));
      if (lastDone > 0) {
        // user has the previous tier — suggest the next
        const next = findAchievementAny(ids[lastDone]);
        if (next) suggestions.push({
          ach: next,
          hint: `Nächste Stufe nach: ${findAchievementAny(ids[lastDone - 1]).title}`,
        });
      }
    }

    // category catch-up
    const emptyCats = D.CATEGORIES.filter(c => myCats[c.id] === 0 || myCats[c.id] === undefined);
    emptyCats.forEach(c => {
      const cheapest = D.ACHIEVEMENTS.filter(a => a.cat === c.id && !myIds.has(a.id))
        .sort((a, b) => a.points - b.points)[0];
      if (cheapest) suggestions.push({
        ach: cheapest,
        hint: `Erstes Achievement in ${c.label}`,
      });
    });

    // dedupe + cap
    const seen = new Set();
    return suggestions.filter(s => {
      if (seen.has(s.ach.id)) return false;
      seen.add(s.ach.id);
      return true;
    }).slice(0, 4);
  }

  function renderSuggestions() {
    const list = buildSuggestions();
    const el = $('[data-bind-section="suggestions"]');
    if (!el) return;
    if (list.length === 0) { el.hidden = true; return; }
    el.hidden = false;
    const target = $('[data-bind="suggestions"]');
    target.innerHTML = list.map(s => `
      <li class="suggestion" data-cat="${s.ach.cat}" data-suggest-ach-id="${s.ach.id}">
        <span class="suggestion__icon">${categoryIcon(s.ach.cat)}</span>
        <div class="suggestion__main">
          <div class="suggestion__title">${escapeHtml(s.ach.title)}</div>
          <div class="suggestion__hint">${escapeHtml(s.hint)}</div>
        </div>
        <span class="suggestion__points">+${fmtNum(s.ach.points)}</span>
      </li>
    `).join('');
  }

  /* ─── STATS ─── */
  const CAT_COLORS = {
    finanzen: '#84CC16',
    fitness:  '#1E40FF',
    skills:   '#EC4899',
    streaks:  '#F59E0B',
    social:   '#7C3AED',
    travel:   '#0EA5E9',
    mind:     '#14B8A6',
  };

  function renderStats() {
    const u = state.user;
    if (!u) return;
    resolveChallenges();

    const score = userScore(u);
    setText('stats.score', fmtNum(score));

    // weekly delta — points earned in last 7 days
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().slice(0, 10);
    const weekPoints = (u.achievements || []).reduce((sum, ach) => {
      if (!ach.date || ach.date < weekAgoISO) return sum;
      const def = findAchievementAny(ach.id);
      return sum + (def ? def.points : 0);
    }, 0);
    const deltaEl = $('[data-bind="stats.delta"]');
    if (deltaEl) {
      deltaEl.textContent = `+${fmtNum(weekPoints)} / Woche`;
      deltaEl.classList.toggle('stats-hero__delta--neg', weekPoints === 0);
      if (weekPoints === 0) deltaEl.textContent = `0 / Woche`;
    }

    renderDonut(u);
    renderSparkline(u);
    renderWeekGrid(u);
    renderContribGrid(u);
    renderHighlights(u);
  }

  function renderContribGrid(u) {
    const el = $('[data-bind="contribGrid"]');
    if (!el) return;

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    // start: last 12 weeks Monday
    const dow = (today.getDay() + 6) % 7; // 0 = Mon
    const lastMonday = new Date(today); lastMonday.setDate(today.getDate() - dow);
    const start = new Date(lastMonday); start.setDate(lastMonday.getDate() - 11 * 7);

    // points per day from achievements
    const dayPoints = {};
    (u.achievements || []).forEach(ach => {
      const def = findAchievementAny(ach.id);
      if (!def) return;
      dayPoints[ach.date] = (dayPoints[ach.date] || 0) + def.points;
    });

    function levelFor(p) {
      if (!p) return 0;
      if (p < 100) return 1;
      if (p < 500) return 2;
      if (p < 1500) return 3;
      return 4;
    }

    const cells = [];
    const totalDays = 12 * 7;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const isToday = iso === todayISO;
      const isFuture = iso > todayISO;
      const points = dayPoints[iso] || 0;
      const level = isFuture ? -1 : levelFor(points);
      const dateLabel = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
      const tooltip = isFuture ? '' : `${dateLabel}: ${points > 0 ? '+' + fmtNum(points) + ' Punkte' : 'kein Win'}`;
      cells.push(`
        <li class="contrib-cell ${level >= 0 ? 'contrib-cell--' + level : 'contrib-cell--future'} ${isToday ? 'contrib-cell--today' : ''}" title="${escapeHtml(tooltip)}"></li>
      `);
    }
    el.innerHTML = cells.join('');
  }

  function renderDonut(u) {
    const points = userCategoryPoints(u);
    const total = Object.values(points).reduce((a, b) => a + b, 0);
    const svg = $('[data-bind="donut"]');
    const legend = $('[data-bind="donutLegend"]');
    if (!svg || !legend) return;

    if (total === 0) {
      svg.innerHTML = `
        <circle cx="100" cy="100" r="78" fill="none" stroke="#E5E5E0" stroke-width="22"/>
        <text x="100" y="98" text-anchor="middle" class="donut__center">0</text>
        <text x="100" y="116" text-anchor="middle" class="donut__center-label">PUNKTE</text>
      `;
      legend.innerHTML = '<li class="donut-legend__row"><span class="donut-legend__name">Noch nichts gesammelt.</span></li>';
      return;
    }

    const cats = D.CATEGORIES.filter(c => points[c.id] > 0);
    const cx = 100, cy = 100, r = 78, sw = 22;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const segments = cats.map(c => {
      const pct = points[c.id] / total;
      const len = circ * pct;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${CAT_COLORS[c.id]}" stroke-width="${sw}" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
      offset += len;
      return seg;
    }).join('');
    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F4F4F0" stroke-width="${sw}"/>
      ${segments}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut__center">${fmtNum(total)}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut__center-label">PUNKTE</text>
    `;

    legend.innerHTML = cats.sort((a, b) => points[b.id] - points[a.id]).map(c => {
      const pct = Math.round((points[c.id] / total) * 100);
      return `
        <li class="donut-legend__row">
          <span class="donut-legend__dot" style="background:${CAT_COLORS[c.id]}"></span>
          <span class="donut-legend__name">${escapeHtml(c.label)}</span>
          <span class="donut-legend__pct">${pct}%</span>
        </li>
      `;
    }).join('');
  }

  function renderSparkline(u) {
    const svg = $('[data-bind="sparkline"]');
    if (!svg) return;
    // Group user's achievements into 8 weekly buckets ending today
    const now = new Date();
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now); start.setDate(now.getDate() - (i + 1) * 7);
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      weeks.push({ startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10), points: 0 });
    }
    let cumulative = 0;
    (u.achievements || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(ach => {
      const def = findAchievementAny(ach.id);
      if (!def) return;
      const week = weeks.find(w => ach.date >= w.startISO && ach.date < w.endISO);
      if (week) week.points += def.points;
    });
    const cumWeeks = weeks.map(w => { cumulative += w.points; return cumulative; });

    if (cumulative === 0) {
      svg.innerHTML = `<text x="160" y="50" text-anchor="middle" font-family="var(--mono)" font-size="12" fill="#A1A1AA">Noch keine Daten</text>`;
      return;
    }

    const W = 320, H = 100;
    const padX = 12, padY = 16;
    const max = Math.max(...cumWeeks, 1);
    const points = cumWeeks.map((v, i) => {
      const x = padX + ((W - 2 * padX) * (i / (cumWeeks.length - 1)));
      const y = H - padY - ((H - 2 * padY) * (v / max));
      return [x, y];
    });
    const line = points.map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join(' ');
    const area = `M${points[0][0]} ${H - padY} ${line.replace('M', 'L')} L${points[points.length-1][0]} ${H - padY} Z`;
    const dots = points.map(p => `<circle class="sparkline__dot" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('');

    svg.innerHTML = `
      <path class="sparkline__area" d="${area}"/>
      <path class="sparkline__line" d="${line}"/>
      ${dots}
    `;
  }

  function renderWeekGrid(u) {
    const el = $('[data-bind="weekGrid"]');
    if (!el) return;
    const days = ['Mo','Di','Mi','Do','Fr','Sa','So'];
    const today = new Date();
    const weekStart = new Date(today);
    const dow = (today.getDay() + 6) % 7; // 0 = Mon
    weekStart.setDate(today.getDate() - dow);

    const cells = days.map((label, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const todayISO = today.toISOString().slice(0, 10);
      const isToday = iso === todayISO;
      const isFuture = iso > todayISO;
      const points = (u.achievements || []).reduce((sum, a) => {
        if (a.date !== iso) return sum;
        const def = findAchievementAny(a.id);
        return sum + (def ? def.points : 0);
      }, 0);
      const cls = isToday ? 'week-day--active' : (points > 0 ? 'week-day--hot' : '');
      return `
        <li class="week-day ${cls}" title="${iso}">
          <span class="week-day__label">${label}</span>
          <span class="week-day__num">${isFuture ? '·' : (points > 0 ? '+' + (points >= 1000 ? Math.round(points / 100) / 10 + 'k' : points) : '0')}</span>
        </li>
      `;
    }).join('');
    el.innerHTML = cells;
  }

  function renderHighlights(u) {
    const el = $('[data-bind="highlights"]');
    if (!el) return;
    const ach = (u.achievements || [])
      .map(a => ({ ach: a, def: findAchievementAny(a.id) }))
      .filter(x => x.def);
    if (ach.length === 0) {
      el.innerHTML = '<li class="ach-feed__empty"><div class="ach-feed__empty-icon">·</div><div class="ach-feed__empty-title">Noch keine Highlights</div><div class="ach-feed__empty-text">Sobald du Achievements freischaltest, erscheinen hier deine größten Wins.</div></li>';
      return;
    }
    const top = ach.slice().sort((a, b) => b.def.points - a.def.points).slice(0, 3);
    const recent = ach.slice().sort((a, b) => (b.ach.date || '').localeCompare(a.ach.date || ''))[0];
    const items = [
      { title: 'Größter Win', sub: top[0].def.title, num: '+' + fmtNum(top[0].def.points), icon: '🏆', color: CAT_COLORS[top[0].def.cat] + '22' },
    ];
    if (recent) items.push({ title: 'Letzter Win', sub: recent.def.title, num: '+' + fmtNum(recent.def.points), icon: '◐', color: CAT_COLORS[recent.def.cat] + '22' });
    items.push({ title: 'Achievements gesamt', sub: `${ach.length} freigeschaltet`, num: ach.length, icon: '✦', color: '#1E40FF22' });

    el.innerHTML = items.map(h => `
      <li class="highlight">
        <span class="highlight__icon" style="background:${h.color}">${h.icon}</span>
        <div class="highlight__main">
          <div class="highlight__title">${escapeHtml(h.title)}</div>
          <div class="highlight__sub">${escapeHtml(h.sub)}</div>
        </div>
        <span class="highlight__num">${h.num}</span>
      </li>
    `).join('');
  }

  /* ─── SQUADS ─── */
  function loadSquads() {
    try {
      const stored = JSON.parse(localStorage.getItem('ranked.squads') || 'null');
      if (stored && Array.isArray(stored)) return stored;
    } catch (e) {}
    return D.MOCK_SQUADS.map(s => ({ ...s, members: s.members.slice() }));
  }
  function saveSquads() { localStorage.setItem('ranked.squads', JSON.stringify(state.squads || [])); }
  function squadMemberScore(memberId) {
    if (memberId === 'me') return userScore(state.user);
    const f = D.findFriend(memberId) || friendsList().find(x => x.id === memberId);
    return f ? f.score : 0;
  }
  function squadTotal(s) {
    return s.members.reduce((sum, m) => sum + squadMemberScore(m), 0);
  }

  function renderSquadsHome() {
    if (!state.squads) state.squads = loadSquads();
    const el = $('[data-bind="squadsHome"]');
    if (!el) return;
    if (state.squads.length === 0) {
      el.innerHTML = `
        <li class="ach-feed__empty">
          <div class="ach-feed__empty-icon">⚡</div>
          <div class="ach-feed__empty-title">Noch kein Squad</div>
          <div class="ach-feed__empty-text">Erstelle einen Squad mit 3-5 Freunden — interner Team-Score und Ranking.</div>
        </li>`;
      return;
    }
    el.innerHTML = state.squads.map(s => {
      const total = squadTotal(s);
      const memberAvatars = s.members.slice(0, 4).map(m => {
        const name = m === 'me' ? state.user.name : (D.findFriend(m) || friendsList().find(x => x.id === m) || {}).name;
        if (!name) return '';
        const c = m === 'me' ? userAvatarColor(state.user) : D.avatarColor(name);
        return `<div class="avatar avatar--sm" style="background:${c.bg};color:${c.fg}">${initials(name)}</div>`;
      }).join('');
      return `
        <li class="squad-card" data-squad-id="${s.id}">
          <span class="squad-card__emoji">${escapeHtml(s.emoji)}</span>
          <div class="squad-card__main">
            <div class="squad-card__name">${escapeHtml(s.name)}</div>
            <div class="squad-card__meta">
              <div class="squad-card__avatars">${memberAvatars}</div>
              <span>${s.members.length} Mitglieder</span>
            </div>
          </div>
          <span class="squad-card__score">${fmtNum(total)}</span>
        </li>
      `;
    }).join('');
  }

  function renderSquadDetail() {
    const s = state.squads.find(sq => sq.id === state.viewingSquadId);
    if (!s) return;
    const total = squadTotal(s);

    // weekly delta calc — sum of week-points from each member
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().slice(0, 10);

    function memberWeekPoints(memberId) {
      if (memberId === 'me') {
        return (state.user.achievements || [])
          .filter(a => a.date >= weekAgoISO)
          .reduce((s, a) => s + (findAchievementAny(a.id)?.points || 0), 0);
      }
      const f = D.findFriend(memberId) || friendsList().find(x => x.id === memberId);
      if (!f) return 0;
      return (f.achievements || [])
        .filter(a => a.date >= weekAgoISO)
        .reduce((s, a) => s + (findAchievementAny(a.id)?.points || 0), 0);
    }

    const weekTotal = s.members.reduce((sum, m) => sum + memberWeekPoints(m), 0);

    const ranked = s.members.map(m => {
      const isMe = m === 'me';
      const name = isMe ? state.user.name : (D.findFriend(m) || friendsList().find(x => x.id === m) || {}).name;
      if (!name) return null;
      return {
        id: m, name, isMe,
        score: squadMemberScore(m),
        weekPts: memberWeekPoints(m),
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    // squad activity: last 10 achievements from any member
    const allActs = [];
    s.members.forEach(m => {
      const isMe = m === 'me';
      const name = isMe ? state.user.name : (D.findFriend(m) || friendsList().find(x => x.id === m) || {}).name;
      if (!name) return;
      const member = isMe ? state.user : (D.findFriend(m) || friendsList().find(x => x.id === m));
      (member.achievements || []).forEach(ach => {
        const def = findAchievementAny(ach.id);
        if (!def) return;
        allActs.push({ memberId: m, name, isMe, ach, def });
      });
    });
    allActs.sort((a, b) => (b.ach.date || '').localeCompare(a.ach.date || ''));

    const target = $('[data-bind="squadDetail"]');
    target.innerHTML = `
      <div class="squad-hero">
        <div class="squad-hero__row">
          <div class="squad-hero__emoji">${escapeHtml(s.emoji)}</div>
          <div>
            <div class="squad-hero__name">${escapeHtml(s.name)}</div>
            <div class="squad-hero__sub">${s.members.length} Mitglieder · seit ${fmtDate(s.createdAt)}</div>
          </div>
        </div>
        <div class="squad-hero__total">
          <span class="squad-hero__total-num">${fmtNum(total)}</span>
          <span class="squad-hero__total-label">Squad-Score · +${fmtNum(weekTotal)} diese Woche</span>
        </div>
      </div>

      <ul class="squad-members">
        ${ranked.map((m, i) => {
          const c = m.isMe ? userAvatarColor(state.user) : D.avatarColor(m.name);
          return `
            <li class="squad-member" data-profile-id="${m.id}">
              <span class="squad-member__rank ${i === 0 ? 'squad-member__rank--top1' : ''}">${i + 1}</span>
              <div class="avatar avatar--sm" style="background:${c.bg};color:${c.fg}">${initials(m.name)}</div>
              <div class="squad-member__main">
                <div class="squad-member__name">${escapeHtml(m.name)}${m.isMe ? ' (Du)' : ''}</div>
                <div class="squad-member__sub">${i === 0 ? '🏆 Top-Scorer' : `Platz ${i + 1} im Squad`}${m.weekPts > 0 ? ' · +' + fmtNum(m.weekPts) + ' diese Woche' : ''}</div>
              </div>
              <span class="squad-member__score">${fmtNum(m.score)}</span>
            </li>
          `;
        }).join('')}
      </ul>

      ${allActs.length > 0 ? `
        <section class="section">
          <header class="section__head">
            <h3 class="section__title">Squad-Aktivität</h3>
            <span class="section__hint">Letzte Wins</span>
          </header>
          <ol class="ach-feed">
            ${allActs.slice(0, 10).map(item => `
              <li class="ach-item" data-profile-id="${item.memberId}">
                <span class="ach-item__icon">${categoryIcon(item.def.cat)}</span>
                <div class="ach-item__main">
                  <div class="ach-item__title">${escapeHtml(item.name)} · ${escapeHtml(item.def.title)}</div>
                  <div class="ach-item__meta">
                    <span>${fmtAgo(item.ach.date)}</span>
                  </div>
                </div>
                <span class="ach-item__points">+${fmtNum(item.def.points)}</span>
              </li>
            `).join('')}
          </ol>
        </section>
      ` : ''}
    `;
  }

  function openSquad(id) {
    state.viewingSquadId = id;
    go('squad');
  }

  function openCreateSquad() {
    state.newSquadMembers = ['me'];
    const list = $('[data-bind="squadMemberPicker"]');
    if (list) {
      list.innerHTML = friendsList().map(f => `
        <li class="squad-pick" data-squad-pick="${f.id}">
          ${avatarHtml(f.name, 'sm')}
          <span class="squad-pick__name">${escapeHtml(f.name)}</span>
          <span class="squad-pick__check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>
        </li>
      `).join('');
    }
    const m = $('#create-squad-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  function commitCreateSquad(form) {
    const fd = new FormData(form);
    const name = (fd.get('squadName') || '').toString().trim();
    const emoji = (fd.get('squadEmoji') || '⚡').toString().trim();
    if (!name) return;
    const squad = {
      id: 'sq.user.' + Date.now(),
      name, emoji,
      members: state.newSquadMembers || ['me'],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    if (!state.squads) state.squads = loadSquads();
    state.squads.push(squad);
    saveSquads();
    closeAllModals();
    toast(`Squad "${name}" erstellt`);
    soundLevelup();
    render();
  }

  /* ─── MAP / TRAVEL ─── */
  function userVisitedCountries() {
    const u = state.user;
    return (u && u.visitedCountries) ? u.visitedCountries : [];
  }
  function travelPoints(u) {
    return (u.achievements || []).reduce((sum, ach) => {
      const def = findAchievementAny(ach.id);
      return sum + (def && def.cat === 'travel' ? def.points : 0);
    }, 0);
  }

  function renderMap() {
    const u = state.user;
    if (!u) return;

    const visited = userVisitedCountries();
    const continents = new Set(visited.map(id => {
      const c = D.findCountry(id);
      return c ? c.continent : null;
    }).filter(Boolean));

    setText('map.countries', visited.length);
    setText('map.continents', continents.size);
    setText('map.points', fmtNum(travelPoints(u)));
    setText('map.countriesLabel', visited.length === 1 ? '1 Land' : `${visited.length} Länder`);

    // SVG world map (stylized — concentric continent shapes)
    const svg = $('[data-bind="mapSvg"]');
    if (svg) {
      // approx continent blobs as ellipses
      const continentShapes = `
        <ellipse class="map-svg__land" cx="80"  cy="65"  rx="22" ry="20"/>
        <ellipse class="map-svg__land" cx="118" cy="135" rx="14" ry="32"/>
        <ellipse class="map-svg__land" cx="190" cy="62"  rx="22" ry="14"/>
        <ellipse class="map-svg__land" cx="208" cy="110" rx="22" ry="35"/>
        <ellipse class="map-svg__land" cx="275" cy="90"  rx="38" ry="32"/>
        <ellipse class="map-svg__land" cx="310" cy="148" rx="14" ry="10"/>
      `;

      const pinElements = D.COUNTRIES.map(c => {
        const isVisited = visited.includes(c.id);
        if (isVisited) {
          return `
            <circle class="map-svg__pulse" cx="${c.x}" cy="${c.y}" r="2.5"/>
            <circle class="map-svg__pin" cx="${c.x}" cy="${c.y}" r="2.8"/>
          `;
        }
        return `<circle class="map-svg__pin map-svg__pin--unvisited" cx="${c.x}" cy="${c.y}" r="1.6"/>`;
      }).join('');

      svg.innerHTML = continentShapes + pinElements;
    }

    // country list
    const listEl = $('[data-bind="countryList"]');
    if (listEl) {
      if (visited.length === 0) {
        listEl.innerHTML = `
          <li class="ach-feed__empty" style="flex: 1">
            <div class="ach-feed__empty-icon">✈</div>
            <div class="ach-feed__empty-title">Noch keine Länder</div>
            <div class="ach-feed__empty-text">Tap auf das +-Icon oben rechts, um besuchte Länder hinzuzufügen.</div>
          </li>`;
      } else {
        listEl.innerHTML = visited.map(id => {
          const c = D.findCountry(id);
          if (!c) return '';
          return `
            <li class="country-pill" data-country-id="${id}">
              <span class="country-pill__flag">${c.flag}</span>
              <span>${escapeHtml(c.name)}</span>
              <button class="country-pill__remove" type="button" data-remove-country="${id}" title="Entfernen">×</button>
            </li>
          `;
        }).join('');
      }
    }
  }

  function openAddCountry() {
    renderCountrySearch('');
    const m = $('#add-country-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
    setTimeout(() => $('[data-bind-id="country-search"]').focus(), 100);
  }

  function renderCountrySearch(query) {
    const q = (query || '').trim().toLowerCase();
    const visited = userVisitedCountries();
    const results = D.COUNTRIES.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    ).sort((a, b) => a.name.localeCompare(b.name));

    const el = $('[data-bind="countrySearchResults"]');
    if (!el) return;
    if (results.length === 0) {
      el.innerHTML = `<li class="search-results__empty">Kein Land gefunden für "${escapeHtml(query)}"</li>`;
      return;
    }
    el.innerHTML = results.map(c => {
      const added = visited.includes(c.id);
      return `
        <li class="country-search-row ${added ? 'country-search-row--added' : ''}" data-add-country-id="${c.id}">
          <span class="country-search-row__flag">${c.flag}</span>
          <span class="country-search-row__name">${escapeHtml(c.name)}</span>
          <span class="country-search-row__cont">${escapeHtml(D.CONTINENTS[c.continent] || c.continent)}</span>
          ${added ? '<span class="country-search-row__check">✓</span>' : ''}
        </li>
      `;
    }).join('');
  }

  function addCountry(id) {
    const u = state.user;
    if (!u.visitedCountries) u.visitedCountries = [];
    if (u.visitedCountries.includes(id)) return;
    u.visitedCountries.push(id);
    saveUser();
    const c = D.findCountry(id);
    toast(`${c ? c.flag + ' ' + c.name : 'Land'} hinzugefügt`);
    vibrate(15);
    renderCountrySearch($('[data-bind-id="country-search"]')?.value || '');
    if (document.body.dataset.view === 'map') renderMap();
  }

  function removeCountry(id) {
    const u = state.user;
    if (!u.visitedCountries) return;
    u.visitedCountries = u.visitedCountries.filter(x => x !== id);
    saveUser();
    renderMap();
  }

  /* ─── HISTORY ─── */
  function renderHistory() {
    const u = state.user;
    if (!u) return;

    const filtersEl = $('[data-bind="historyFilters"]');
    const filters = [{ id: 'all', label: 'Alle' }, ...D.CATEGORIES];
    filtersEl.innerHTML = filters.map(f => `
      <button class="chip ${(state.historyFilter || 'all') === f.id ? 'chip--active' : ''}" data-history-filter="${f.id}" type="button">
        ${f.icon ? f.icon + ' ' : ''}${f.label}
      </button>
    `).join('');

    const list = $('[data-bind="historyList"]');
    let items = (u.achievements || [])
      .map(a => ({ ach: a, def: findAchievementAny(a.id) }))
      .filter(x => x.def)
      .sort((a, b) => (b.ach.date || '').localeCompare(a.ach.date || ''));
    if (state.historyFilter && state.historyFilter !== 'all') {
      items = items.filter(x => x.def.cat === state.historyFilter);
    }
    if (items.length === 0) {
      list.innerHTML = '<li class="ach-feed__empty"><div class="ach-feed__empty-icon">·</div><div class="ach-feed__empty-title">Keine Achievements</div><div class="ach-feed__empty-text">In dieser Kategorie noch nichts geschafft.</div></li>';
      return;
    }
    list.innerHTML = items.map(({ ach, def }) => `
      <li class="history-item">
        <div class="history-item__rail">
          <span class="history-item__dot" style="border-color:${CAT_COLORS[def.cat]}"></span>
        </div>
        <div class="history-item__card">
          <div class="history-item__row">
            <div style="flex:1; min-width: 0;">
              <div class="history-item__title">${escapeHtml(def.title)}</div>
              <div class="history-item__meta">
                <span>${fmtDate(ach.date)}</span>
                <span>·</span>
                <span>${escapeHtml(D.CATEGORIES.find(c => c.id === def.cat)?.label || def.cat)}</span>
                <span>·</span>
                <span style="color:${ach.cityVerified ? 'var(--lime-deep)' : 'var(--ink-3)'}">${ach.cityVerified ? '✓ Stadt' : '✓ Friend'}</span>
              </div>
            </div>
            <span class="history-item__points">+${fmtNum(def.points)}</span>
          </div>
        </div>
      </li>
    `).join('');
  }

  /* ─── add-achievement modal ─── */
  function openAddAchievement() {
    state.activeCat = 'finanzen';
    renderAddModal();
    const m = $('#add-achievement-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }
  function renderAddModal() {
    const tabsEl = $('[data-bind="catTabs"]');
    tabsEl.innerHTML = D.CATEGORIES.map(c => `
      <button class="seg__btn ${state.activeCat === c.id ? 'seg__btn--active' : ''}" type="button" data-cat="${c.id}">
        ${c.icon} ${c.label}
      </button>
    `).join('');

    renderAchList();
  }

  function allAchievements() {
    const customs = (state.user && state.user.customAchievements) || [];
    return [...customs, ...D.ACHIEVEMENTS];
  }
  function findAchievementAny(id) {
    return allAchievements().find(a => a.id === id) || findAchievementAny(id);
  }

  function renderAchList() {
    const listEl = $('[data-bind="achList"]');
    const myIds = new Set((state.user.achievements || []).map(a => a.id));
    const q = (state.achSearchQuery || '').trim().toLowerCase();

    let filtered = allAchievements();
    if (q) {
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.sub || '').toLowerCase().includes(q) ||
        a.cat.toLowerCase().includes(q)
      );
    } else {
      filtered = filtered.filter(a => a.cat === state.activeCat);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<li class="ach-feed__empty"><div class="ach-feed__empty-icon">·</div><div class="ach-feed__empty-title">Nichts gefunden</div><div class="ach-feed__empty-text">Probiere einen anderen Suchbegriff.</div></li>`;
      return;
    }

    listEl.innerHTML = filtered.map(a => {
      const done = myIds.has(a.id);
      const isCustom = a.id.startsWith('custom.');
      return `
        <li class="ach-row ${done ? 'ach-row--done' : ''}" data-ach-id="${a.id}">
          <span class="ach-item__icon">${categoryIcon(a.cat)}</span>
          <div class="ach-row__main">
            <div class="ach-row__title">${escapeHtml(a.title)}${isCustom ? ' <span style="font-family: var(--mono); font-size: 9px; padding: 2px 6px; border-radius: 4px; background: var(--magenta-tint); color: var(--magenta-deep); margin-left: 4px;">CUSTOM</span>' : ''}</div>
            <div class="ach-row__sub ${done ? 'ach-row__sub--done' : ''}">
              ${done ? '✓ bereits geschafft' : (q ? escapeHtml(D.CATEGORIES.find(c => c.id === a.cat)?.label || '') + ' · ' + escapeHtml(a.sub || '') : escapeHtml(a.sub || ''))}
            </div>
          </div>
          <span class="ach-row__points">+${fmtNum(a.points)}</span>
        </li>
      `;
    }).join('');
  }
  function renderGlobalAchSearch(q) {
    state.achSearchQuery = q;
    renderAchList();
  }

  /* ─── add-trophy modal ─── */
  function openAddTrophy() {
    const m = $('#add-trophy-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  /* ─── confirm flow ─── */
  function openConfirmFlow(achievementId) {
    const def = findAchievementAny(achievementId);
    if (!def) return;
    state.pending = {
      achievementId, points: def.points, title: def.title,
      friends: [], proof: null,
    };
    setText('confirm.name', def.title);
    setText('confirm.points', fmtNum(def.points));
    setText('confirm.cat', categoryLabel(def.cat));
    setText('confirm.proofName', '');

    const flist = $('[data-bind="confirm.friends"]');
    flist.innerHTML = friendsList().map(f => `
      <li class="confirm-friend" data-friend-id="${f.id}">
        ${avatarHtml(f.name, 'sm')}
        <span class="confirm-friend__name">${escapeHtml(f.name)}</span>
        <span class="confirm-friend__check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      </li>
    `).join('');

    closeAllModals();
    const m = $('#confirm-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }
  function commitConfirmation() {
    const p = state.pending;
    if (!p) return;
    if (p.friends.length === 0) {
      toast('Mindestens ein Freund muss bestätigen');
      return;
    }
    const def = findAchievementAny(p.achievementId);
    if (!def) return;

    const photoId = p.proofFile ? `photo.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` : null;
    if (photoId) {
      // fire-and-forget save (won't block UI)
      savePhoto(photoId, p.proofFile);
    }

    const ach = {
      id: p.achievementId,
      date: new Date().toISOString().slice(0, 10),
      verified: true,
      cityVerified: !!p.proof,
      confirmedBy: p.friends.slice(),
      proofName: p.proof || null,
      photoId: photoId,
    };
    state.user.achievements = state.user.achievements || [];
    if (!state.user.achievements.find(a => a.id === ach.id)) {
      state.user.achievements.push(ach);
    }
    // simulated friend reactions: 2-4 random friends react with random emoji types
    const friends = friendsList();
    const reactCount = 2 + Math.floor(Math.random() * 3);
    const shuffled = friends.slice().sort(() => Math.random() - 0.5).slice(0, reactCount);
    ach.friendReactions = shuffled.map(f => ({
      friendId: f.id,
      kind: ['fire','heart','clap'][Math.floor(Math.random() * 3)],
    }));
    saveUser();
    const achievementId = p.achievementId;
    state.pending = null;
    closeAllModals();
    confetti();
    vibrate([20, 40, 30]);
    soundAchievement(def.points);
    toast(`+${fmtNum(def.points)} — ${def.title}`);
    render();
    // open share-card after a short delay so confetti registers first
    setTimeout(() => openShareCard(achievementId), 900);
  }
  function closeAllModals() {
    $$('.modal').forEach(m => { if (m.open) m.close(); else m.removeAttribute('open'); });
  }

  /* ─── search modal ─── */
  function openSearch() {
    renderSearch('');
    const m = $('#search-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
    setTimeout(() => $('[data-bind-id="search-input"]').focus(), 100);
  }
  function renderSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const results = D.SEARCH_POOL.filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
    const el = $('[data-bind="searchResults"]');
    if (results.length === 0) {
      el.innerHTML = `<li class="search-results__empty">Niemanden gefunden für "${escapeHtml(query)}"</li>`;
      return;
    }
    el.innerHTML = results.map(r => {
      const added = state.addedFriends.includes(r.id);
      return `
        <li class="search-row" data-search-id="${r.id}">
          ${avatarHtml(r.name, 'sm')}
          <div class="search-row__main">
            <div class="search-row__name">${escapeHtml(r.name)}</div>
            <div class="search-row__sub">${escapeHtml(r.city)} · ${fmtNum(r.score)} Punkte</div>
          </div>
          <button class="search-row__btn ${added ? 'search-row__btn--added' : ''}" data-add-friend="${r.id}" type="button">
            ${added ? '✓ Hinzugefügt' : '+ Hinzufügen'}
          </button>
        </li>
      `;
    }).join('');
  }

  function findUserById(id) {
    if (id === 'me') return state.user;
    return D.FRIENDS.find(f => f.id === id) || D.CITY_USERS.find(c => c.id === id) || friendsList().find(f => f.id === id);
  }

  async function shareRecapText() {
    const data = buildRecapData();
    if (!data) return;
    const u = state.user;
    const text = `📊 Meine Ranked-Woche: +${fmtNum(data.weekPoints)} Punkte, ${data.achCount} Achievements. ${u.name} aus ${u.city}, #${data.currentRank} unter Friends.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Ranked Wochenrückblick', text }); toast('Geteilt'); }
      catch (e) {}
    } else if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); toast('Text kopiert'); }
      catch (e) { toast('Konnte nicht kopieren'); }
    }
  }

  /* ─── COMPARE MODE ─── */
  function openCompare(otherId) {
    const other = state.activeTab === 'friends'
      ? friendsRanking().find(u => u.id === otherId)
      : cityRanking().find(u => u.id === otherId);
    const fallback = D.FRIENDS.find(f => f.id === otherId) || D.CITY_USERS.find(c => c.id === otherId);
    const target = other || fallback;
    if (!target) { toast('Profil nicht gefunden'); return; }
    if (target.isMe) { toast('Du kannst dich nicht mit dir selbst vergleichen'); return; }
    renderCompare(target);
    const m = $('#compare-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  function renderCompare(other) {
    const u = state.user;
    const myScore = userScore(u);
    const myCats = userCategoryPoints(u);
    const myAchCount = (u.achievements || []).length;
    const myCityRankNum = myCityRank();
    const myFriendRankNum = myFriendRank();
    const otherCats = other.categoryPoints || {};
    const otherAchCount = (other.achievements || []).length;

    const rows = [
      { label: 'Score', me: myScore, them: other.score, big: true },
      { label: 'Stadt-Rang', me: typeof myCityRankNum === 'number' ? myCityRankNum : 999, them: other.cityRank || 999, lower: true },
      { label: 'Achievements', me: myAchCount, them: otherAchCount },
      ...D.CATEGORIES.map(c => ({ label: c.label, me: myCats[c.id] || 0, them: otherCats[c.id] || 0 })),
    ];

    const meColor = userAvatarColor(u);
    const themColor = D.avatarColor(other.name);

    const rowsHtml = rows.map(r => {
      const meWins = r.lower ? r.me < r.them : r.me > r.them;
      const themWins = r.lower ? r.them < r.me : r.them > r.me;
      return `
        <div class="compare-row">
          <span class="compare-row__num compare-row__num--me ${meWins ? 'compare-row__num--winner' : ''}">${r.lower && r.me === 999 ? '—' : fmtNum(r.me)}</span>
          <span class="compare-row__label">${escapeHtml(r.label)}</span>
          <span class="compare-row__num compare-row__num--them ${themWins ? 'compare-row__num--winner' : ''}">${r.lower && r.them === 999 ? '—' : fmtNum(r.them)}</span>
        </div>
      `;
    }).join('');

    let headline = '';
    if (myScore > other.score) headline = `Du führst mit ${fmtNum(myScore - other.score)} Punkten Vorsprung.`;
    else if (myScore < other.score) headline = `${other.name} führt mit ${fmtNum(other.score - myScore)} Punkten.`;
    else headline = 'Kopf-an-Kopf — gleicher Score.';

    const target = $('[data-bind="compareView"]');
    target.innerHTML = `
      <div class="compare-hero">
        <div class="compare-hero__side compare-hero__side--me">
          ${avatarHtml(u.name, 'lg', meColor)}
          <span class="compare-hero__name">Du</span>
          <span class="compare-hero__score">${fmtNum(myScore)}</span>
          <span class="compare-hero__score-label">Punkte</span>
        </div>
        <div class="compare-hero__vs">VS</div>
        <div class="compare-hero__side compare-hero__side--them">
          ${avatarHtml(other.name, 'lg', themColor)}
          <span class="compare-hero__name">${escapeHtml(other.name)}</span>
          <span class="compare-hero__score">${fmtNum(other.score)}</span>
          <span class="compare-hero__score-label">Punkte</span>
        </div>
      </div>
      <p class="compare-headline">${escapeHtml(headline)}</p>
      ${rowsHtml}
    `;
  }

  /* ─── ACHIEVEMENT DETAIL ─── */
  function openAchDetail(achId, contextUser) {
    const def = findAchievementAny(achId);
    if (!def) return;
    const user = contextUser || state.user;
    const ach = (user.achievements || []).find(a => a.id === achId);
    const bind = $('[data-bind="achDetail"]');
    if (!bind) return;

    const cat = D.CATEGORIES.find(c => c.id === def.cat);
    const gradientNum = ((achId.charCodeAt(0) || 0) % 5) + 1;
    const showPhoto = ach && ach.cityVerified;
    const photoId = ach && ach.photoId;
    const date = ach ? fmtDate(ach.date) : '—';
    const verifyText = ach ? (ach.cityVerified ? 'Stadt-verifiziert' : 'Friend-verifiziert') : 'Vorschau';

    const confirmedBy = ach && ach.confirmedBy ? ach.confirmedBy : [];
    const confirmersHtml = confirmedBy.length > 0 ? `
      <div>
        <div class="ach-detail__meta-label" style="margin-bottom: 6px;">Bestätigt von</div>
        <ul class="ach-detail__confirmers">
          ${confirmedBy.map(fid => {
            const f = D.findFriend(fid) || friendsList().find(x => x.id === fid);
            if (!f) return '';
            return `
              <li class="ach-detail__confirmer">
                ${avatarHtml(f.name, 'sm')}
                <span style="flex:1">${escapeHtml(f.name)}</span>
                <span class="ach-detail__confirmer-check">✓</span>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    ` : '';

    const reactionsArr = ach && ach.friendReactions ? ach.friendReactions : [];
    const reactEmoji = { fire: '🔥', heart: '❤️', clap: '👏' };
    const reactionsHtml = reactionsArr.length > 0 ? `
      <div>
        <div class="ach-detail__meta-label" style="margin-bottom: 6px;">Reactions von Friends</div>
        <ul class="ach-detail__confirmers">
          ${reactionsArr.map(r => {
            const f = D.findFriend(r.friendId) || friendsList().find(x => x.id === r.friendId);
            if (!f) return '';
            return `
              <li class="ach-detail__confirmer" style="background: var(--surface); border-color: var(--border);">
                ${avatarHtml(f.name, 'sm')}
                <span style="flex:1">${escapeHtml(f.name)}</span>
                <span style="font-size: 16px;">${reactEmoji[r.kind] || '🔥'}</span>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    ` : '';

    bind.innerHTML = `
      <div class="ach-detail">
        <div class="ach-detail__hero" data-cat="${def.cat}">
          <span class="ach-detail__cat-pill">${escapeHtml(cat ? cat.label : def.cat)}</span>
          <h2 class="ach-detail__title">${escapeHtml(def.title)}</h2>
          <p class="ach-detail__sub">${escapeHtml(def.sub || '')}</p>
          <div class="ach-detail__points">+${fmtNum(def.points)}</div>
        </div>

        ${showPhoto ? `
          <div class="ach-detail__photo ach-detail__photo--g${gradientNum}" data-photo-id="${photoId || ''}">
            <span style="position: relative; z-index: 1; padding: 6px 14px; background: rgba(0,0,0,0.4); backdrop-filter: blur(6px); border-radius: 999px;">📷 Foto-Beweis</span>
          </div>
        ` : ''}

        <div class="ach-detail__meta-grid">
          <div class="ach-detail__meta">
            <span class="ach-detail__meta-label">Datum</span>
            <div class="ach-detail__meta-val">${date}</div>
          </div>
          <div class="ach-detail__meta">
            <span class="ach-detail__meta-label">Verifikation</span>
            <div class="ach-detail__meta-val" style="color: ${ach && ach.cityVerified ? 'var(--lime-deep)' : 'var(--ink-2)'}">${verifyText}</div>
          </div>
        </div>

        ${confirmersHtml}
        ${reactionsHtml}
      </div>
    `;

    const m = $('#ach-detail-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');

    // load actual photo if available
    if (photoId) {
      const photoEl = bind.querySelector('.ach-detail__photo');
      getPhotoUrl(photoId).then(url => {
        if (url && photoEl) {
          photoEl.style.background = `url("${url}") center / cover no-repeat`;
          photoEl.style.color = '#FFF';
        }
      });
    }
  }

  /* ─── WEEKLY RECAP ─── */
  function buildRecapData() {
    const u = state.user;
    if (!u) return null;
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString().slice(0, 10);

    const weekAchs = (u.achievements || []).filter(a => a.date >= weekAgoISO);
    const prevWeekAchs = (u.achievements || []).filter(a => a.date >= twoWeeksAgoISO && a.date < weekAgoISO);

    const sumPoints = (list) => list.reduce((s, a) => {
      const def = findAchievementAny(a.id);
      return s + (def ? def.points : 0);
    }, 0);

    const weekPoints = sumPoints(weekAchs);
    const prevWeekPoints = sumPoints(prevWeekAchs);
    const delta = weekPoints - prevWeekPoints;

    // friends ranking change
    const myRankNow = myFriendRank();
    // approximate previous rank by removing this week's points
    const myScore = userScore(u);
    const myScorePrev = myScore - weekPoints;
    const friends = [...D.FRIENDS];
    let prevRank = 1;
    friends.forEach(f => { if (f.score > myScorePrev) prevRank++; });
    const rankChange = prevRank - myRankNow;

    return {
      weekPoints, prevWeekPoints, delta,
      achCount: weekAchs.length,
      bestAch: weekAchs.map(a => ({ a, def: findAchievementAny(a.id) })).filter(x => x.def).sort((a, b) => b.def.points - a.def.points)[0],
      rankChange,
      currentRank: myRankNow,
    };
  }

  function openRecap() {
    const data = buildRecapData();
    if (!data) return;
    const u = state.user;
    const weekLabel = (() => {
      const now = new Date();
      const w = new Date(now); w.setDate(now.getDate() - 7);
      return `Woche ${fmtDate(w.toISOString())} – ${fmtDate(now.toISOString())}`;
    })();

    const deltaText = data.delta > 0
      ? `+${fmtNum(data.delta)} mehr als letzte Woche`
      : data.delta < 0
        ? `${fmtNum(data.delta)} weniger als letzte Woche`
        : 'Gleich wie letzte Woche';

    const rankText = data.rankChange > 0
      ? `+${data.rankChange} Plätze gestiegen`
      : data.rankChange < 0
        ? `${data.rankChange} Plätze gefallen`
        : 'Position gehalten';

    const bestText = data.bestAch
      ? `${data.bestAch.def.title} (+${fmtNum(data.bestAch.def.points)})`
      : '—';

    const bind = $('[data-bind="recapBody"]');
    bind.innerHTML = `
      <div class="recap">
        <div class="recap__hero">
          <div class="recap__week">${escapeHtml(weekLabel)}</div>
          <div class="recap__num">${data.weekPoints > 0 ? '+' : ''}${fmtNum(data.weekPoints)}</div>
          <div class="recap__num-label">Punkte diese Woche</div>
        </div>

        <div class="recap__stat-grid">
          <div class="recap__stat">
            <span class="recap__stat-label">Δ Vorwoche</span>
            <div class="recap__stat-val" style="color: ${data.delta > 0 ? 'var(--lime-deep)' : data.delta < 0 ? 'var(--magenta-deep)' : 'var(--ink-2)'}">${data.delta > 0 ? '+' : ''}${fmtNum(data.delta)}</div>
            <span class="recap__stat-sub">${escapeHtml(deltaText)}</span>
          </div>
          <div class="recap__stat">
            <span class="recap__stat-label">Achievements</span>
            <div class="recap__stat-val">${data.achCount}</div>
            <span class="recap__stat-sub">freigeschaltet</span>
          </div>
          <div class="recap__stat">
            <span class="recap__stat-label">Friend-Rang</span>
            <div class="recap__stat-val" style="color: ${data.rankChange > 0 ? 'var(--lime-deep)' : data.rankChange < 0 ? 'var(--magenta-deep)' : 'var(--ink)'}">#${data.currentRank}</div>
            <span class="recap__stat-sub">${escapeHtml(rankText)}</span>
          </div>
          <div class="recap__stat">
            <span class="recap__stat-label">Größter Win</span>
            <div class="recap__stat-val" style="font-size: 14px; line-height: 1.2; margin-top: 6px;">${escapeHtml(bestText.length > 28 ? bestText.slice(0, 28) + '…' : bestText)}</div>
          </div>
        </div>
      </div>
    `;

    const m = $('#recap-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  function maybeShowRecap() {
    if (!state.user) return;
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const lastShown = localStorage.getItem('ranked.recap.lastShown');
    if (lastShown === todayISO) return;
    // only show on Sunday OR first weekly visit
    const isSunday = today.getDay() === 0;
    const weekKey = (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday of this week
      return d.toISOString().slice(0, 10);
    })();
    const lastWeek = localStorage.getItem('ranked.recap.weekShown');
    if (isSunday && lastWeek !== weekKey) {
      localStorage.setItem('ranked.recap.weekShown', weekKey);
      localStorage.setItem('ranked.recap.lastShown', todayISO);
      // delay to let home render first
      setTimeout(openRecap, 1200);
    }
  }

  /* ─── notifications ─── */
  function buildNotifications() {
    const items = [];
    if (!state.challenges) state.challenges = loadChallenges();
    state.challenges.forEach(ch => {
      const def = findAchievementAny(ch.achievementId);
      if (!def) return;
      const fromFriend = ch.from === 'me' ? null : (D.findFriend(ch.from) || friendsList().find(f => f.id === ch.from));
      if (ch.status === 'pending' && ch.to === 'me' && fromFriend) {
        items.push({
          id: 'n.' + ch.id,
          icon: '⚡', kind: 'challenge',
          title: `${fromFriend.name} fordert dich heraus`,
          sub: `${def.title} · 1.000 Punkte stehen auf dem Spiel`,
          when: ch.createdAt,
          unread: true,
          action: 'home',
        });
      }
      if (ch.status === 'won') {
        items.push({
          id: 'n.won.' + ch.id,
          icon: '🏆', kind: 'good',
          title: `Challenge gewonnen — ${def.title}`,
          sub: `+1.000 Bonus-Punkte`,
          when: ch.resolvedAt || ch.createdAt,
          unread: false,
        });
      }
      if (ch.status === 'lost') {
        items.push({
          id: 'n.lost.' + ch.id,
          icon: '✕', kind: 'challenge',
          title: `Challenge verloren — ${def.title}`,
          sub: `–1.000 Punkte abgezogen`,
          when: ch.resolvedAt || ch.deadline,
          unread: false,
        });
      }
    });

    // recent friend activities (top 5)
    if (!state.activityStream) state.activityStream = D.buildActivityStream();
    state.activityStream.slice(0, 5).forEach(item => {
      items.push({
        id: 'n.act.' + item.id,
        icon: '◐', kind: 'default',
        title: `${item.friend.name} hat geclaimt`,
        sub: `${item.achievement.title} · +${fmtNum(item.achievement.points)}`,
        when: item.date,
        unread: false,
        profileId: item.friendId,
      });
    });

    items.sort((a, b) => (b.when || '').localeCompare(a.when || ''));
    return items;
  }
  function unreadNotifCount() {
    return buildNotifications().filter(n => n.unread).length;
  }
  function refreshNotifBadge() {
    const el = $('[data-bind="notif.count"]');
    if (!el) return;
    const c = unreadNotifCount();
    if (c > 0) {
      el.hidden = false;
      el.textContent = c > 9 ? '9+' : String(c);
    } else {
      el.hidden = true;
    }
  }
  function openNotifications() {
    const items = buildNotifications();
    const el = $('[data-bind="notifList"]');
    if (items.length === 0) {
      el.innerHTML = `
        <li class="ach-feed__empty">
          <div class="ach-feed__empty-icon">◌</div>
          <div class="ach-feed__empty-title">Alles ruhig</div>
          <div class="ach-feed__empty-text">Keine offenen Benachrichtigungen.</div>
        </li>`;
    } else {
      el.innerHTML = items.map(n => `
        <li class="notif-row" ${n.profileId ? `data-profile-id="${n.profileId}"` : ''} ${n.action ? `data-action-go="${n.action}"` : ''}>
          <span class="notif-row__icon notif-row__icon--${n.kind}">${n.icon}</span>
          <div class="notif-row__main">
            <div class="notif-row__title">${escapeHtml(n.title)}</div>
            <div class="notif-row__sub">${escapeHtml(n.sub)}</div>
          </div>
          <span class="notif-row__when">${fmtAgo(n.when)}</span>
        </li>
      `).join('');
    }
    const m = $('#notifications-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  /* ─── settings modal ─── */
  function updateSoundLabel() {
    const btn = $('[data-bind="sound.label"]');
    if (btn) btn.textContent = isSoundEnabled() ? '🔊 Sound an' : '🔇 Sound aus';
  }

  function openSettings() {
    const u = state.user;
    if (!u) return;
    const form = $('#settings-form');
    form.elements.settingsName.value = u.name || '';
    form.elements.settingsCity.value = u.city || '';
    form.elements.settingsHeight.value = u.height || '';
    form.elements.settingsWeight.value = u.weight || '';
    form.elements.settingsBio.value = u.bio || '';
    form.elements.settingsGoal.value = u.goal || '';
    form.elements.settingsColor.value = u.avatarColor || 'auto';
    renderColorPicker('settingsColors', u.avatarColor || 'auto');
    updateSoundLabel();
    updateThemeButtons();
    const m = $('#settings-modal');
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  /* ─── event delegation ─── */
  document.addEventListener('click', (e) => {
    const t = e.target;

    const actionEl = t.closest('[data-action]');
    if (actionEl) {
      const action = actionEl.dataset.action;
      switch (action) {
        case 'goto-onboarding': go('onboarding'); return;
        case 'back-to-splash':  go('splash'); return;
        case 'back':            back(); return;
        case 'logout':
          if (confirm('Profil wirklich zurücksetzen? Alle Achievements werden gelöscht.')) {
            clearUser(); state.history = ['splash']; closeAllModals(); go('splash');
          }
          return;
        case 'onb-next':        nextOnbStep(); return;
        case 'open-add-achievement': openAddAchievement(); return;
        case 'add-trophy':      openAddTrophy(); return;
        case 'open-search':     openSearch(); return;
        case 'open-settings':   openSettings(); return;
        case 'open-notifications': openNotifications(); return;
        case 'open-filter':     toast('Filter ist unter dem Tab-Switch'); return;
        case 'close-modal':     closeAllModals(); return;
        case 'confirm-achievement': commitConfirmation(); return;
        case 'open-create-challenge': openCreateChallenge(); return;
        case 'share-achievement': shareAchievement(); return;
        case 'open-history': go('history'); return;
        case 'open-compare':
          if (state.profileViewing) openCompare(state.profileViewing);
          return;
        case 'share-recap':
          shareRecapText();
          return;
        case 'open-recap':
          openRecap();
          return;
        case 'open-map':
          go('map');
          return;
        case 'add-country':
          openAddCountry();
          return;
        case 'open-create-squad':
          openCreateSquad();
          return;
        case 'add-goal':
          openAddGoal();
          return;
        case 'open-custom-ach': {
          const m = $('#custom-ach-modal');
          m.querySelectorAll('input').forEach(i => { if (i.name !== 'caPoints') i.value = ''; });
          if (typeof m.showModal === 'function') m.showModal();
          else m.setAttribute('open', '');
          return;
        }
        case 'replay-tutorial':
          localStorage.removeItem('ranked.tutorial.done');
          closeAllModals();
          setTimeout(startTutorial, 400);
          return;
        case 'post-comment':
          postComment();
          return;
        case 'export-data':
          exportData();
          return;
        case 'toggle-sound': {
          const enabled = isSoundEnabled();
          if (enabled) localStorage.setItem('ranked.sound.off', '1');
          else localStorage.removeItem('ranked.sound.off');
          if (!enabled) soundOpen();
          updateSoundLabel();
          return;
        }
      }
    }

    // goal toggle / remove
    const goalToggle = t.closest('[data-toggle-goal]');
    if (goalToggle) {
      e.stopPropagation();
      toggleGoalDone(goalToggle.dataset.toggleGoal);
      return;
    }
    const goalRm = t.closest('[data-remove-goal]');
    if (goalRm) {
      e.stopPropagation();
      removeGoal(goalRm.dataset.removeGoal);
      return;
    }

    // theme switch
    const themeBtn = t.closest('[data-theme-set]');
    if (themeBtn) {
      setTheme(themeBtn.dataset.themeSet);
      return;
    }

    // squad card click
    const squadCard = t.closest('[data-squad-id]');
    if (squadCard) {
      openSquad(squadCard.dataset.squadId);
      return;
    }
    // squad member picker
    const squadPick = t.closest('[data-squad-pick]');
    if (squadPick) {
      const id = squadPick.dataset.squadPick;
      if (!state.newSquadMembers) state.newSquadMembers = ['me'];
      const idx = state.newSquadMembers.indexOf(id);
      if (idx >= 0) state.newSquadMembers.splice(idx, 1);
      else state.newSquadMembers.push(id);
      squadPick.classList.toggle('squad-pick--checked');
      return;
    }

    // country search row
    const cAdd = t.closest('[data-add-country-id]');
    if (cAdd && !cAdd.classList.contains('country-search-row--added')) {
      addCountry(cAdd.dataset.addCountryId);
      return;
    }
    // remove country
    const cRm = t.closest('[data-remove-country]');
    if (cRm) {
      e.stopPropagation();
      removeCountry(cRm.dataset.removeCountry);
      return;
    }

    // ach-feed item → detail
    const achItem = t.closest('.ach-item[data-ach-id]');
    if (achItem) {
      const achId = achItem.dataset.achId;
      const ctx = (document.body.dataset.view === 'profile' && state.profileViewing)
        ? findUserById(state.profileViewing)
        : state.user;
      openAchDetail(achId, ctx);
      return;
    }

    // tutorial actions
    const tutBtn = t.closest('[data-tutorial-action]');
    if (tutBtn) {
      const a = tutBtn.dataset.tutorialAction;
      if (a === 'next') nextTutorial();
      else if (a === 'skip') finishTutorial();
      return;
    }

    // suggestion → confirm flow
    const sugg = t.closest('[data-suggest-ach-id]');
    if (sugg) {
      openConfirmFlow(sugg.dataset.suggestAchId);
      return;
    }

    // history filter chip
    const hFilter = t.closest('[data-history-filter]');
    if (hFilter) {
      state.historyFilter = hFilter.dataset.historyFilter;
      renderHistory();
      return;
    }

    // challenge accept/decline
    const chBtn = t.closest('[data-challenge-action]');
    if (chBtn) {
      e.stopPropagation();
      const id = chBtn.dataset.challengeId;
      if (chBtn.dataset.challengeAction === 'accept') acceptChallenge(id);
      else if (chBtn.dataset.challengeAction === 'decline') declineChallenge(id);
      return;
    }

    // tabbar / route
    const routeEl = t.closest('[data-route]');
    if (routeEl) {
      const r = routeEl.dataset.route;
      if (routeEl.dataset.tab) state.activeTab = routeEl.dataset.tab;
      e.preventDefault();
      go(r);
      return;
    }

    // leaderboard segment
    const segBtn = t.closest('.seg__btn');
    if (segBtn && segBtn.dataset.tab) {
      state.activeTab = segBtn.dataset.tab;
      renderLeaderboard();
      return;
    }
    // category tab in modal
    if (segBtn && segBtn.dataset.cat) {
      state.activeCat = segBtn.dataset.cat;
      renderAddModal();
      return;
    }

    // filter chip
    const chip = t.closest('.chip');
    if (chip && chip.dataset.filter) {
      state.activeFilter = chip.dataset.filter;
      renderLeaderboard();
      return;
    }

    // achievement row → confirm flow
    const achRow = t.closest('.ach-row');
    if (achRow && !achRow.classList.contains('ach-row--done')) {
      openConfirmFlow(achRow.dataset.achId);
      return;
    }

    // friend toggle in confirm
    const friendEl = t.closest('.confirm-friend');
    if (friendEl) {
      const id = friendEl.dataset.friendId;
      const p = state.pending;
      if (!p) return;
      const idx = p.friends.indexOf(id);
      if (idx >= 0) p.friends.splice(idx, 1); else p.friends.push(id);
      friendEl.classList.toggle('confirm-friend--checked');
      return;
    }

    // search add
    const addBtn = t.closest('[data-add-friend]');
    if (addBtn) {
      e.stopPropagation();
      const id = addBtn.dataset.addFriend;
      if (!state.addedFriends.includes(id)) {
        state.addedFriends.push(id);
        const r = D.SEARCH_POOL.find(s => s.id === id);
        toast(`${r ? r.name : 'Freund'} hinzugefügt`);
      }
      const query = $('[data-bind-id="search-input"]').value;
      renderSearch(query);
      return;
    }

    // comment button
    const commentBtn = t.closest('.activity-card__comment');
    if (commentBtn) {
      e.stopPropagation();
      const card = commentBtn.closest('[data-activity-id]') || commentBtn.closest('.activity-card__foot');
      if (card) {
        const aid = card.dataset.activityId || card.querySelector('[data-activity-id]')?.dataset.activityId;
        if (aid) openComments(aid);
      }
      return;
    }

    // reactions
    const reactBtn = t.closest('.reaction');
    if (reactBtn) {
      e.stopPropagation();
      const card = reactBtn.closest('[data-activity-id]');
      const aid = card.dataset.activityId;
      const kind = reactBtn.dataset.react;
      state.reactions[aid] = state.reactions[aid] || {};
      const wasActive = state.reactions[aid][kind];
      state.reactions[aid][kind] = !wasActive;
      saveReactions();
      if (!wasActive) { soundReaction(); vibrate(8); }
      renderFeed();
      return;
    }

    // notification row → profile or view
    const notifRow = t.closest('.notif-row');
    if (notifRow) {
      closeAllModals();
      if (notifRow.dataset.profileId) {
        state.profileViewing = notifRow.dataset.profileId;
        go('profile');
      } else if (notifRow.dataset.actionGo) {
        go(notifRow.dataset.actionGo);
      }
      return;
    }

    // story chip → profile
    const storyEl = t.closest('.story');
    if (storyEl && storyEl.dataset.profileId) {
      state.profileViewing = storyEl.dataset.profileId;
      go('profile');
      return;
    }

    // color-swatch picker
    const swatchEl = t.closest('.color-swatch');
    if (swatchEl) {
      const list = swatchEl.parentElement;
      list.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch--active'));
      swatchEl.classList.add('color-swatch--active');
      // update the hidden input next to the list
      const wrap = list.closest('.field');
      const hiddenInput = wrap && wrap.querySelector('input[type="hidden"]');
      if (hiddenInput) hiddenInput.value = swatchEl.dataset.color;
      vibrate(8);
      return;
    }

    // board / activity-card → profile
    const boardRow = t.closest('.board__row');
    if (boardRow && boardRow.dataset.profileId && !boardRow.classList.contains('board__row--me')) {
      state.profileViewing = boardRow.dataset.profileId;
      go('profile');
      return;
    }
    const actCard = t.closest('.activity-card');
    if (actCard && actCard.dataset.profileId) {
      state.profileViewing = actCard.dataset.profileId;
      go('profile');
      return;
    }
  });

  /* ─── search input live ─── */
  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-bind-id="search-input"]')) {
      renderSearch(e.target.value);
    }
    if (e.target.matches('[data-bind-id="country-search"]')) {
      renderCountrySearch(e.target.value);
    }
    if (e.target.matches('[data-bind-id="ach-global-search"]')) {
      renderGlobalAchSearch(e.target.value);
    }
  });

  /* ─── onboarding step ─── */
  function nextOnbStep() {
    const form = $('#onboarding-form');
    const panes = $$('.onb__pane', form);
    const visibleIndex = panes.findIndex(p => !p.hidden);
    if (visibleIndex < 0) return;
    const current = panes[visibleIndex];
    const inputs = $$('input[required]', current);
    for (const inp of inputs) {
      if (!inp.value.trim()) {
        inp.focus();
        inp.style.borderColor = 'var(--hot)';
        setTimeout(() => inp.style.borderColor = '', 1500);
        return;
      }
    }
    if (visibleIndex < panes.length - 1) {
      current.hidden = true;
      panes[visibleIndex + 1].hidden = false;
      const stepEl = $('[data-onb-step]');
      if (stepEl) stepEl.textContent = visibleIndex + 2;
      if (visibleIndex + 1 === panes.length - 1) {
        // step 3 — render color picker
        renderColorPicker('onbColors', 'auto');
      }
    }
  }

  /* ─── form submits ─── */
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'onboarding-form') {
      e.preventDefault();
      const fd = new FormData(e.target);
      state.user = {
        name: (fd.get('name') || '').toString().trim(),
        city: (fd.get('city') || '').toString().trim(),
        height: Number(fd.get('height')) || null,
        weight: Number(fd.get('weight')) || null,
        avatarColor: (fd.get('avatarColor') || 'auto').toString(),
        achievements: [], trophies: [],
        bonusPoints: 0,
        createdAt: new Date().toISOString(),
      };
      saveUser();
      state.history = ['home'];
      go('home', { skipHistory: true });
      toast('Profil angelegt — leg los!');
      // start tutorial after a short delay so home renders first
      setTimeout(startTutorial, 800);
    }

    if (e.target.id === 'add-trophy-form') {
      e.preventDefault();
      const fd = new FormData(e.target);
      const trophy = {
        cat: fd.get('trophyCategory'),
        label: (fd.get('trophyLabel') || '').toString().trim(),
        detail: (fd.get('trophyDetail') || '').toString().trim(),
      };
      if (!trophy.label) return;
      state.user.trophies = state.user.trophies || [];
      state.user.trophies.push(trophy);
      saveUser();
      e.target.reset();
      closeAllModals();
      toast('Trophy hinzugefügt');
      render();
    }

    if (e.target.id === 'create-challenge-form') {
      e.preventDefault();
      commitCreateChallenge(e.target);
    }

    if (e.target.id === 'create-squad-form') {
      e.preventDefault();
      commitCreateSquad(e.target);
    }

    if (e.target.id === 'add-goal-form') {
      e.preventDefault();
      commitAddGoal(e.target);
    }

    if (e.target.id === 'custom-ach-form') {
      e.preventDefault();
      const fd = new FormData(e.target);
      const ca = {
        id: 'custom.' + Date.now(),
        title: (fd.get('caTitle') || '').toString().trim(),
        sub: (fd.get('caSub') || '').toString().trim(),
        cat: fd.get('caCat'),
        points: parseInt(fd.get('caPoints'), 10) || 500,
        custom: true,
      };
      if (!ca.title) return;
      if (!state.user.customAchievements) state.user.customAchievements = [];
      state.user.customAchievements.unshift(ca);
      saveUser();
      closeAllModals();
      toast('Achievement erstellt — claim es jetzt');
      soundLevelup();
      // re-open add-achievement-modal so user can claim immediately
      setTimeout(() => {
        state.activeCat = ca.cat;
        openAddAchievement();
      }, 400);
    }

    if (e.target.id === 'settings-form') {
      e.preventDefault();
      const fd = new FormData(e.target);
      state.user.name = (fd.get('settingsName') || '').toString().trim() || state.user.name;
      state.user.city = (fd.get('settingsCity') || '').toString().trim() || state.user.city;
      state.user.height = Number(fd.get('settingsHeight')) || state.user.height;
      state.user.weight = Number(fd.get('settingsWeight')) || state.user.weight;
      state.user.bio = (fd.get('settingsBio') || '').toString().trim();
      state.user.goal = (fd.get('settingsGoal') || '').toString().trim();
      state.user.avatarColor = (fd.get('settingsColor') || 'auto').toString();
      saveUser();
      closeAllModals();
      toast('Profil aktualisiert');
      render();
    }
  });

  /* ─── proof file change ─── */
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-bind-id="import-data"]')) {
      const file = e.target.files && e.target.files[0];
      if (file) importData(file);
      e.target.value = '';
      return;
    }
    if (e.target.matches('[data-bind-id="confirm-proof-camera"], [data-bind-id="confirm-proof-gallery"], [data-bind-id="confirm-proof"]')) {
      const file = e.target.files && e.target.files[0];
      if (state.pending) {
        state.pending.proof = file ? file.name : null;
        state.pending.proofFile = file || null;
      }
      setText('confirm.proofName', file ? '✓ ' + file.name : '');
      // visual preview thumbnail next to upload-label
      const preview = $('[data-bind="confirm.proofPreview"]');
      if (preview) {
        if (file) {
          preview.style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
          preview.classList.add('upload__preview--has');
        } else {
          preview.style.backgroundImage = '';
          preview.classList.remove('upload__preview--has');
        }
      }
    }
  });

  /* ─── init ─── */
  function init() {
    state.user = loadUser();
    state.reactions = loadReactions();
    state.challenges = loadChallenges();
    state.squads = loadSquads();
    state.comments = loadComments();
    seedMockComments();

    // brief loading screen on cold start
    setTimeout(() => {
      if (state.user) {
        state.history = ['home'];
        go('home', { skipHistory: true });
        maybeShowRecap();
      } else {
        go('splash', { skipHistory: true });
      }
    }, 1400);
  }
  init();

})();
