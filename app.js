/* app.js
   MiniLogicPlay — modular front-end game manager with localStorage demo auth
   Keep this file small & expand game modules below.
*/

(() => {
  /* ---------- App state & utilities ---------- */
  const STORAGE_KEY = 'minilogic_user';
  const games = [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Auth (localStorage-based demo) ---------- */
  function authLoad() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return null; }
  }
  function authSave(user) { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); }
  function authClear() { localStorage.removeItem(STORAGE_KEY); }

  const UI = {
    main: $('#main'),
    content: $('#content'),
    gameList: $('#game-list'),
    authModal: $('#auth-modal'),
    authForm: $('#auth-form'),
    authUsername: $('#auth-username'),
    authPassword: $('#auth-password'),
    authClose: $('#auth-close'),
    authBtn: $('#btn-login'),
    signupBtn: $('#btn-signup'),
    authDemo: $('#auth-demo'),
    btnProfile: $('#btn-profile'),
    btnLogout: $('#btn-logout'),
    welcomeMsg: $('#welcome-msg'),
    sidebar: $('#sidebar'),
  };

  /* ---------- Simple Auth UI ---------- */
  function showAuthModal(prefill = {}) {
    UI.authModal.classList.remove('hidden');
    if (prefill.username) UI.authUsername.value = prefill.username;
    UI.authPassword.value = '';
    UI.authUsername.focus();
  }
  function hideAuthModal() { UI.authModal.classList.add('hidden'); }

  UI.authBtn.addEventListener('click', () => showAuthModal());
  UI.authClose.addEventListener('click', hideAuthModal);
  UI.authDemo.addEventListener('click', () => {
    // demo login
    const demo = { username: 'demo', displayName: 'Demo User', created: Date.now() };
    authSave(demo);
    hideAuthModal();
    renderAuth();
  });

  UI.authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = UI.authUsername.value.trim();
    const password = UI.authPassword.value; // not used for security — demo only
    if (!username) return alert('Please enter a username');
    const user = { username, displayName: username, created: Date.now() };
    authSave(user);
    hideAuthModal();
    renderAuth();
  });

  UI.signupBtn.addEventListener('click', () => showAuthModal());

  UI.btnLogout.addEventListener('click', () => {
    authClear();
    renderAuth();
    navigateTo('home');
  });

  UI.btnProfile.addEventListener('click', () => {
    const user = authLoad();
    if (user) {
      alert(`Signed in as ${user.displayName}\nUsername: ${user.username}`);
    } else {
      showAuthModal();
    }
  });

  function renderAuth() {
    const user = authLoad();
    if (user) {
      UI.welcomeMsg.textContent = `Hello, ${user.displayName}!`;
      UI.btnProfile.textContent = 'Profile';
      UI.btnLogout.classList.remove('hidden');
      UI.authBtn.classList.add('hidden');
      UI.signupBtn.classList.add('hidden');
    } else {
      UI.welcomeMsg.textContent = 'Play logic games & sharpen your mind.';
      UI.authBtn.classList.remove('hidden');
      UI.signupBtn.classList.remove('hidden');
      UI.btnLogout.classList.add('hidden');
    }
  }

  /* ---------- Simple Router / Game loader ---------- */
  function registerGame(id, title, description, moduleInit) {
    games.push({ id, title, description, init: moduleInit });
  }

  function buildGameList() {
    UI.gameList.innerHTML = '';
    games.forEach((g, idx) => {
      const li = document.createElement('li');
      li.textContent = g.title;
      li.setAttribute('role', 'button');
      li.tabIndex = 0;
      li.addEventListener('click', () => navigateTo(g.id));
      li.addEventListener('keypress', (e) => { if (e.key === 'Enter') navigateTo(g.id); });
      UI.gameList.appendChild(li);
      if (idx === 0) li.classList.add('active');
    });
  }

  function activateListItem(id) {
    $$('li', UI.gameList).forEach(li => {
      li.classList.toggle('active', li.textContent === getGame(id).title);
    });
  }

  function getGame(id) {
    return games.find(g => g.id === id);
  }

  function navigateTo(id) {
    const pane = document.createElement('div');
    pane.className = 'pane';
    pane.id = `pane-${id}`;
    UI.content.innerHTML = '';
    UI.content.appendChild(pane);
    activateListItem(id);
    const g = getGame(id);
    if (!g) {
      $('#home').classList.remove('hidden');
      return;
    }
    g.init(pane, { saveState, loadState, isLoggedIn: !!authLoad() });
  }

  /* ---------- Persistence helpers for games ---------- */
  function saveState(key, state) {
    const user = authLoad() || { username: 'anon' };
    const rootKey = `mlp_state:${user.username}:${key}`;
    try {
      localStorage.setItem(rootKey, JSON.stringify(state));
    } catch (e) { console.warn('Failed to save state', e); }
  }
  function loadState(key) {
    const user = authLoad() || { username: 'anon' };
    const rootKey = `mlp_state:${user.username}:${key}`;
    try { return JSON.parse(localStorage.getItem(rootKey)); }
    catch (e) { return null; }
  }

  /* ---------- Game Module: Logic Quiz (simple MCQ engine) ---------- */
  registerGame('logic-quiz', 'Logic Quiz', 'Multiple-choice logic questions', (container, helpers) => {
    const questions = [
      { q: 'If all bloops are razzies and all razzies are zaps, are all bloops zaps?', a: 'Yes' , opts:['Yes','No'] },
      { q: 'Which number continues the sequence: 2, 3, 5, 7, 11, ... ?', a: '13', opts:['13','14','15'] },
      { q: 'A train leaves at noon at 60km/h. In 2 hours it travels 120km. True or false?', a: 'True', opts:['True','False'] },
    ];

    container.innerHTML = `
      <h2>Logic Quiz</h2>
      <div class="game-controls">
        <button id="quiz-start" class="btn small">Start</button>
        <button id="quiz-reset" class="btn small btn-ghost">Reset score</button>
        <div id="quiz-score" class="small muted">Score: 0</div>
      </div>
      <div id="quiz-area"></div>
    `;
    const startBtn = $('#quiz-start', container);
    const resetBtn = $('#quiz-reset', container);
    const scoreEl = $('#quiz-score', container);
    const area = $('#quiz-area', container);

    let state = loadState('logic-quiz') || { score: 0, index: 0 };

    function renderQuestion() {
      const q = questions[state.index % questions.length];
      area.innerHTML = `
        <div>
          <p><strong>Q:</strong> ${q.q}</p>
          <div id="opts"></div>
        </div>
      `;
      const opts = $('#opts', area);
      q.opts.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'btn small';
        b.style.marginRight = '6px';
        b.textContent = opt;
        b.addEventListener('click', () => {
          if (opt === q.a) state.score++;
          state.index++;
          scoreEl.textContent = 'Score: ' + state.score;
          saveState('logic-quiz', state);
          renderQuestion();
        });
        opts.appendChild(b);
      });
    }

    startBtn.addEventListener('click', () => { renderQuestion(); });
    resetBtn.addEventListener('click', () => { state = { score:0, index:0 }; saveState('logic-quiz', state); scoreEl.textContent='Score: 0'; area.innerHTML=''; });

    // initial UI
    scoreEl.textContent = 'Score: ' + state.score;
    if (!area.innerHTML) area.innerHTML = `<p class="muted">Press Start to begin.</p>`;
  });

  /* ---------- Game Module: Memory Match (small tile memory) ---------- */
  registerGame('memory-match', 'Memory Match', 'Find matching pairs', (container, helpers) => {
    container.innerHTML = `
      <h2>Memory Match</h2>
      <div class="game-controls">
        <button id="mem-reset" class="btn small">New Game</button>
        <div id="mem-stats" class="small muted">Moves: 0</div>
      </div>
      <div id="mem-board" class="board memory"></div>
    `;
    const board = $('#mem-board', container);
    const resetBtn = $('#mem-reset', container);
    const stats = $('#mem-stats', container);

    const symbols = ['▲','■','●','★','✿','♥','◆','◉'];
    const level = 8; // pairs
    let state = loadState('memory-match') || { moves:0, best: null };
    let deck = [];
    let flipped = [];
    let matched = new Set();

    function newDeck() {
      const sel = symbols.slice(0, level);
      deck = sel.concat(sel).map((s,i)=>({ id:i, symbol:s, uid: `${s}-${i}` }));
      // shuffle
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    function renderBoard() {
      board.innerHTML = '';
      deck.forEach((card, i) => {
        const el = document.createElement('div');
        el.className = 'memory-card';
        el.dataset.uid = card.uid;
        el.dataset.index = i;
        if (matched.has(card.uid)) {
          el.textContent = card.symbol;
          el.style.background = '#d1fae5';
        } else if (flipped.includes(i)) {
          el.textContent = card.symbol;
          el.style.background = '#fff7ed';
        } else {
          el.textContent = '';
        }
        el.addEventListener('click', () => onCardClick(i));
        board.appendChild(el);
      });
      stats.textContent = `Moves: ${state.moves}`;
    }

    function onCardClick(i) {
      if (flipped.includes(i) || matched.has(deck[i].uid)) return;
      if (flipped.length === 2) return;
      flipped.push(i);
      renderBoard();
      if (flipped.length === 2) {
        state.moves++;
        const [a,b] = flipped;
        if (deck[a].symbol === deck[b].symbol) {
          matched.add(deck[a].uid);
          matched.add(deck[b].uid);
          flipped = [];
          checkWin();
        } else {
          setTimeout(()=> { flipped = []; renderBoard(); }, 700);
        }
        saveState('memory-match', state);
      }
    }

    function checkWin() {
      if (matched.size === deck.length) {
        const best = state.best == null ? state.moves : Math.min(state.best, state.moves);
        state.best = best;
        saveState('memory-match', state);
        setTimeout(() => alert(`You won! Moves: ${state.moves}. Best: ${state.best}`), 200);
      }
      renderBoard();
    }

    resetBtn.addEventListener('click', () => {
      startNewGame();
    });

    function startNewGame() {
      newDeck();
      flipped = [];
      matched = new Set();
      state.moves = 0;
      renderBoard();
    }

    // init
    if (!deck.length) startNewGame();
    else renderBoard();
  });

  /* ---------- Boot the app ---------- */
  function init() {
    renderAuth();
    buildGameList();
    // show home by default
    navigateTo('home');
    // wire accessibility: close modal with Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.authModal.classList.add('hidden');
    });
    // click outside modal to close
    UI.authModal.addEventListener('click', (e) => {
      if (e.target === UI.authModal) hideAuthModal();
    });
  }

  // Expose helper for future games to register dynamically (if needed)
  window.MiniLogicPlay = { registerGame, navigateTo };

  init();
})();
