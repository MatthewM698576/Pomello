// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 100; // 628.318

const DEFAULT_SETTINGS = {
  workDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  accentColor: '#7C3AED',
};

// ─── State ────────────────────────────────────────────────────────────────────

let settings = loadSettings();
let theme = localStorage.getItem('pomello_theme') || 'dark';
let tasks = loadTasks();
let mode = 'work';
let timeLeft = settings.workDuration * 60;
let totalTime = settings.workDuration * 60;
let isRunning = false;
let intervalId = null;
let pomodorosCompleted = 0;
let cyclePomos = 0;
let currentTaskId = null;

// ─── DOM ──────────────────────────────────────────────────────────────────────

const $html        = document.documentElement;
const $themeToggle = document.getElementById('theme-toggle');
const $themeIcon   = document.getElementById('theme-icon');
const $settingsBtn = document.getElementById('settings-btn');
const $tabs        = document.querySelectorAll('.tab');
const $timeDisplay = document.getElementById('time-display');
const $modeLabel   = document.getElementById('mode-label');
const $ringProg    = document.getElementById('ring-progress');
const $startBtn    = document.getElementById('start-btn');
const $skipBtn     = document.getElementById('skip-btn');
const $dots        = document.getElementById('session-dots');
const $taskInput   = document.getElementById('task-input');
const $addTaskBtn  = document.getElementById('add-task-btn');
const $taskList    = document.getElementById('task-list');
const $emptyState  = document.getElementById('empty-state');
const $clearDone   = document.getElementById('clear-completed');
const $overlay     = document.getElementById('modal-overlay');
const $closeModal  = document.getElementById('close-modal');
const $cancelBtn   = document.getElementById('cancel-settings');
const $saveBtn     = document.getElementById('save-settings');
const $sWork       = document.getElementById('setting-work');
const $sShort      = document.getElementById('setting-short');
const $sLong       = document.getElementById('setting-long');
const $sInterval   = document.getElementById('setting-interval');
const $colorInput      = document.getElementById('color-input');
const $colorSwatch     = document.getElementById('color-swatch');
const $taskMenuBtn     = document.getElementById('task-menu-btn');
const $taskDropdown    = document.getElementById('task-dropdown');
const $currentTaskBar  = document.getElementById('current-task-bar');
const $currentTaskText = document.getElementById('current-task-text');

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  $html.setAttribute('data-theme', theme);
  applyThemeIcon();
  applyAccent(settings.accentColor);
  $colorInput.value = settings.accentColor;
  $colorSwatch.style.background = settings.accentColor;

  updateDisplay();
  setRingInstant(1);
  renderDots();
  renderTasks();
  renderCurrentTask();
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const MOON_SVG = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
const SUN_SVG  = `<circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/>
  <line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/>
  <line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;

function applyThemeIcon() {
  $themeIcon.innerHTML = theme === 'dark' ? MOON_SVG : SUN_SVG;
}

$themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  $html.setAttribute('data-theme', theme);
  applyThemeIcon();
  localStorage.setItem('pomello_theme', theme);
});

// ─── Accent Color ─────────────────────────────────────────────────────────────

function applyAccent(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  $html.style.setProperty('--accent', hex);
  $html.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}

$colorSwatch.addEventListener('click', () => $colorInput.click());

$colorInput.addEventListener('input', e => {
  $colorSwatch.style.background = e.target.value;
});

// ─── Mode Tabs ────────────────────────────────────────────────────────────────

$tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.mode !== mode) switchMode(tab.dataset.mode);
  });
});

function switchMode(newMode) {
  if (intervalId) clearInterval(intervalId);
  isRunning = false;
  mode = newMode;

  const durations = {
    work:       settings.workDuration,
    shortBreak: settings.shortBreak,
    longBreak:  settings.longBreak,
  };

  totalTime = durations[mode] * 60;
  timeLeft  = totalTime;

  $tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  updateDisplay();
  setRingInstant(1);
  updateStartBtn();
}

// ─── Timer ────────────────────────────────────────────────────────────────────

$startBtn.addEventListener('click', () => {
  isRunning ? pauseTimer() : startTimer();
});

$skipBtn.addEventListener('click', () => {
  if (intervalId) clearInterval(intervalId);
  isRunning = false;
  updateStartBtn();
  // Skip to next mode without counting it as a completed session
  if (mode === 'work') {
    if (cyclePomos + 1 >= settings.longBreakInterval) {
      cyclePomos = 0;
      renderDots();
      switchMode('longBreak');
    } else {
      switchMode('shortBreak');
    }
  } else {
    switchMode('work');
  }
});

function startTimer() {
  isRunning = true;
  updateStartBtn();
  intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(intervalId);
  updateStartBtn();
}

function tick() {
  if (timeLeft <= 0) {
    clearInterval(intervalId);
    isRunning = false;
    onSessionComplete();
    return;
  }
  timeLeft--;
  updateDisplay();
  animateRing(timeLeft / totalTime);
}

function onSessionComplete() {
  playAlarm();

  if (mode === 'work') {
    pomodorosCompleted++;
    cyclePomos++;

    // Credit pomo to the active task
    if (currentTaskId) {
      const task = tasks.find(t => t.id === currentTaskId);
      if (task) {
        task.pomos = (task.pomos || 0) + 1;
        saveTasks();
        renderTasks();
      }
    }

    renderDots();

    if (cyclePomos >= settings.longBreakInterval) {
      cyclePomos = 0;
      switchMode('longBreak');
    } else {
      switchMode('shortBreak');
    }
  } else {
    switchMode('work');
  }
}

function updateStartBtn() {
  $startBtn.textContent = isRunning ? 'Pause' : 'Start';
}

// ─── Display ─────────────────────────────────────────────────────────────────

function updateDisplay() {
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  $timeDisplay.textContent = `${mins}:${secs}`;

  const labels = {
    work:       'Focus Time',
    shortBreak: 'Short Break',
    longBreak:  'Long Break',
  };
  $modeLabel.textContent = labels[mode];
  document.title = `${mins}:${secs} — Pomello`;
}

function setRingInstant(progress) {
  $ringProg.style.transition = 'none';
  $ringProg.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  // Force reflow so the next frame can re-enable transition
  $ringProg.getBoundingClientRect();
  $ringProg.style.transition = '';
}

function animateRing(progress) {
  $ringProg.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

// ─── Session Dots ─────────────────────────────────────────────────────────────

function renderDots() {
  $dots.innerHTML = '';
  for (let i = 0; i < settings.longBreakInterval; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i < cyclePomos ? ' filled' : '');
    $dots.appendChild(dot);
  }
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

$addTaskBtn.addEventListener('click', addTask);
$taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

// ── Task dropdown menu ────────────────────────────────────────────────────────

$taskMenuBtn.addEventListener('click', e => {
  e.stopPropagation();
  $taskDropdown.classList.toggle('open');
});

document.addEventListener('click', () => $taskDropdown.classList.remove('open'));

$clearDone.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  if (currentTaskId && !tasks.find(t => t.id === currentTaskId)) {
    currentTaskId = null;
  }
  saveTasks();
  renderTasks();
  renderCurrentTask();
  $taskDropdown.classList.remove('open');
});

document.getElementById('clear-all').addEventListener('click', () => {
  tasks = [];
  currentTaskId = null;
  saveTasks();
  renderTasks();
  renderCurrentTask();
  $taskDropdown.classList.remove('open');
});

function addTask() {
  const text = $taskInput.value.trim();
  if (!text) return;

  tasks.push({ id: Date.now().toString(), text, completed: false, pomos: 0 });
  saveTasks();
  renderTasks();
  $taskInput.value = '';
  $taskInput.focus();
}

function renderTasks() {
  $taskList.querySelectorAll('.task-item').forEach(el => el.remove());

  if (tasks.length === 0) {
    $emptyState.style.display = 'flex';
  } else {
    $emptyState.style.display = 'none';
    tasks.forEach(task => $taskList.appendChild(createTaskEl(task)));
  }
}

function createTaskEl(task) {
  const el = document.createElement('div');
  el.className = [
    'task-item',
    task.completed ? 'completed' : '',
    task.id === currentTaskId ? 'active' : '',
  ].filter(Boolean).join(' ');
  el.dataset.id = task.id;

  el.innerHTML = `
    <div class="task-checkbox"></div>
    <div class="task-text">${escapeHtml(task.text)}</div>
    <div class="task-meta">
      ${task.pomos > 0 ? `<div class="pomo-badge">🍋 ${task.pomos}</div>` : ''}
      <button class="btn-delete" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>`;

  el.addEventListener('click', e => {
    if (e.target.closest('.task-checkbox')) {
      toggleComplete(task.id);
    } else if (e.target.closest('.btn-delete')) {
      deleteTask(task.id);
    } else {
      setActiveTask(task.id);
    }
  });

  return el;
}

function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (task) { task.completed = !task.completed; saveTasks(); renderTasks(); }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (currentTaskId === id) currentTaskId = null;
  saveTasks();
  renderTasks();
  renderCurrentTask();
}

function setActiveTask(id) {
  currentTaskId = currentTaskId === id ? null : id;
  renderTasks();
  renderCurrentTask();
}

function renderCurrentTask() {
  const task = tasks.find(t => t.id === currentTaskId);
  if (task && !task.completed) {
    $currentTaskText.textContent = task.text;
    $currentTaskBar.classList.add('visible');
  } else {
    currentTaskId = null;
    $currentTaskBar.classList.remove('visible');
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem('pomello_settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings() {
  localStorage.setItem('pomello_settings', JSON.stringify(settings));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem('pomello_tasks');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTasks() {
  localStorage.setItem('pomello_tasks', JSON.stringify(tasks));
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

$settingsBtn.addEventListener('click', openSettings);
$closeModal.addEventListener('click', closeSettings);
$cancelBtn.addEventListener('click', closeSettings);
$overlay.addEventListener('click', e => { if (e.target === $overlay) closeSettings(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $overlay.classList.contains('open')) closeSettings();
});

function openSettings() {
  $sWork.value     = settings.workDuration;
  $sShort.value    = settings.shortBreak;
  $sLong.value     = settings.longBreak;
  $sInterval.value = settings.longBreakInterval;
  $colorInput.value = settings.accentColor;
  $colorSwatch.style.background = settings.accentColor;
  $overlay.classList.add('open');
}

function closeSettings() {
  $overlay.classList.remove('open');
}

$saveBtn.addEventListener('click', () => {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, parseInt(val) || min));

  const newSettings = {
    workDuration:       clamp($sWork.value,     1, 60),
    shortBreak:         clamp($sShort.value,    1, 30),
    longBreak:          clamp($sLong.value,     1, 60),
    longBreakInterval:  clamp($sInterval.value, 1, 10),
    accentColor:        $colorInput.value,
  };

  const intervalChanged = newSettings.longBreakInterval !== settings.longBreakInterval;
  settings = newSettings;
  saveSettings();
  applyAccent(settings.accentColor);

  if (intervalChanged) {
    cyclePomos = Math.min(cyclePomos, settings.longBreakInterval);
    renderDots();
  }

  // Reset timer to new duration if paused
  if (!isRunning) switchMode(mode);

  closeSettings();
});

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Three rising notes: a pleasant major arpeggio
    [[0, 523.25], [0.18, 659.25], [0.36, 783.99]].forEach(([delay, freq]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      osc.start(t);
      osc.stop(t + 0.7);
    });
  } catch (_) { /* audio unavailable */ }
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Go ──────────────────────────────────────────────────────────────────────

init();
