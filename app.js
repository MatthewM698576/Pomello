// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 100; // 628.318

const DEFAULT_SETTINGS = {
  workDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  focusColor: '#7C3AED',
  shortBreakColor: '#0D9488',
  longBreakColor: '#4F46E5',
  autoStart: false,
  alarmSound: 'chime',
  timerStyle: 'ring',
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
let startTimestamp = null;
let startTimeLeft = null;
let autoStartCountdownId = null;
let pomodorosCompleted = 0;
let focusModeActive = false;
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
const $focusSwatch      = document.getElementById('focus-swatch');
const $shortBreakSwatch = document.getElementById('short-break-swatch');
const $longBreakSwatch  = document.getElementById('long-break-swatch');
const $focusColor       = document.getElementById('focus-color');
const $shortBreakColor  = document.getElementById('short-break-color');
const $longBreakColor   = document.getElementById('long-break-color');
const $autoStart        = document.getElementById('setting-autostart');
const $soundOptions     = document.getElementById('sound-options');
const $previewSound     = document.getElementById('preview-sound');
const $styleOptions     = document.querySelector('.style-options');
const $focusModeBtn     = document.getElementById('focus-mode-btn');
const $taskCard         = document.querySelector('.task-card');
const $taskMenuBtn     = document.getElementById('task-menu-btn');
const $taskDropdown    = document.getElementById('task-dropdown');
const $currentTaskBar  = document.getElementById('current-task-bar');
const $currentTaskText = document.getElementById('current-task-text');

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  $html.setAttribute('data-theme', theme);
  applyThemeIcon();
  applyModeColor(mode);
  applyTimerStyle(settings.timerStyle);

  updateDisplay();
  setRingInstant(1);
  renderDots();
  renderTasks();
  renderCurrentTask();
}

function modeColor(m) {
  return { work: settings.focusColor, shortBreak: settings.shortBreakColor, longBreak: settings.longBreakColor }[m];
}

function applyModeColor(m) {
  applyAccent(modeColor(m));
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

// Mode color swatches
[[$focusSwatch, $focusColor], [$shortBreakSwatch, $shortBreakColor], [$longBreakSwatch, $longBreakColor]]
  .forEach(([swatch, input]) => {
    swatch.addEventListener('click', () => input.click());
    input.addEventListener('input', () => { swatch.style.background = input.value; });
  });

// ─── Mode Tabs ────────────────────────────────────────────────────────────────

$tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.mode !== mode) switchMode(tab.dataset.mode);
  });
});

function switchMode(newMode) {
  if (intervalId) clearInterval(intervalId);
  if (autoStartCountdownId) { clearInterval(autoStartCountdownId); autoStartCountdownId = null; }
  isRunning = false;
  mode = newMode;

  const durations = {
    work:       settings.workDuration,
    shortBreak: settings.shortBreak,
    longBreak:  settings.longBreak,
  };

  totalTime = durations[mode] * 60;
  timeLeft  = totalTime;

  applyModeColor(mode);
  $tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  updateDisplay();
  setRingInstant(1);
  updateStartBtn();
}

// ─── Timer ────────────────────────────────────────────────────────────────────

$startBtn.addEventListener('click', () => {
  if (autoStartCountdownId) {
    clearInterval(autoStartCountdownId);
    autoStartCountdownId = null;
    updateDisplay();
    updateStartBtn();
    return;
  }
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
  startTimestamp = Date.now();
  startTimeLeft = timeLeft;
  updateStartBtn();
  intervalId = setInterval(tick, 500);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(intervalId);
  updateStartBtn();
}

function tick() {
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  timeLeft = Math.max(0, startTimeLeft - elapsed);
  updateDisplay();
  animateRing(timeLeft / totalTime);

  if (timeLeft <= 0) {
    clearInterval(intervalId);
    isRunning = false;
    onSessionComplete();
  }
}

// Recalculate immediately when tab comes back into focus
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isRunning) tick();
});

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

  if (settings.autoStart) beginAutoStart();
}

function beginAutoStart() {
  let secs = 3;
  $startBtn.textContent = 'Cancel';
  $modeLabel.textContent = `Starting in ${secs}…`;

  autoStartCountdownId = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(autoStartCountdownId);
      autoStartCountdownId = null;
      startTimer();
    } else {
      $modeLabel.textContent = `Starting in ${secs}…`;
    }
  }, 1000);
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

  $focusColor.value      = settings.focusColor;      $focusSwatch.style.background      = settings.focusColor;
  $shortBreakColor.value = settings.shortBreakColor; $shortBreakSwatch.style.background = settings.shortBreakColor;
  $longBreakColor.value  = settings.longBreakColor;  $longBreakSwatch.style.background  = settings.longBreakColor;

  $autoStart.checked = settings.autoStart;

  pendingSound = settings.alarmSound;
  $soundOptions.querySelectorAll('.sound-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.sound === pendingSound));

  pendingTimerStyle = settings.timerStyle;
  $styleOptions.querySelectorAll('.style-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.style === pendingTimerStyle));

  $overlay.classList.add('open');
}

function closeSettings() {
  $overlay.classList.remove('open');
}

$saveBtn.addEventListener('click', () => {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, parseInt(val) || min));

  const newSettings = {
    workDuration:      clamp($sWork.value,     1, 60),
    shortBreak:        clamp($sShort.value,    1, 30),
    longBreak:         clamp($sLong.value,     1, 60),
    longBreakInterval: clamp($sInterval.value, 1, 10),
    focusColor:        $focusColor.value,
    shortBreakColor:   $shortBreakColor.value,
    longBreakColor:    $longBreakColor.value,
    autoStart:         $autoStart.checked,
    alarmSound:        pendingSound,
    timerStyle:        pendingTimerStyle,
  };

  const intervalChanged = newSettings.longBreakInterval !== settings.longBreakInterval;
  settings = newSettings;
  saveSettings();
  applyModeColor(mode);
  applyTimerStyle(settings.timerStyle);

  if (intervalChanged) {
    cyclePomos = Math.min(cyclePomos, settings.longBreakInterval);
    renderDots();
  }

  if (!isRunning) switchMode(mode);

  closeSettings();
});

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAlarm() {
  playSound(settings.alarmSound);
}

function playSound(name) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    if (name === 'chime') {
      // Soft rising major arpeggio
      [[0, 523.25], [0.18, 659.25], [0.36, 783.99]].forEach(([delay, freq]) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.22, t + delay + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.7);
        osc.start(t + delay); osc.stop(t + delay + 0.75);
      });

    } else if (name === 'bell') {
      // Single resonant bell with harmonics
      [[1, 0.22], [2, 0.08], [3, 0.04]].forEach(([harmonic, vol]) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = 440 * harmonic;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        osc.start(t); osc.stop(t + 2.6);
      });

    } else if (name === 'digital') {
      // Three quick square-wave beeps
      [0, 0.18, 0.36].forEach(delay => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.12, t + delay);
        gain.gain.setValueAtTime(0, t + delay + 0.1);
        osc.start(t + delay); osc.stop(t + delay + 0.12);
      });

    } else if (name === 'ding') {
      // Single clean high ding
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 1318.51;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.start(t); osc.stop(t + 1.25);
    }
  } catch (_) { /* audio unavailable */ }
}

// ─── Sound Picker ────────────────────────────────────────────────────────────

let pendingSound = settings.alarmSound;

$soundOptions.addEventListener('click', e => {
  const btn = e.target.closest('.sound-btn');
  if (!btn) return;
  pendingSound = btn.dataset.sound;
  $soundOptions.querySelectorAll('.sound-btn').forEach(b => b.classList.toggle('selected', b === btn));
});

$previewSound.addEventListener('click', () => playSound(pendingSound));

// ─── Timer Style ─────────────────────────────────────────────────────────────

let pendingTimerStyle = settings.timerStyle;

$styleOptions.addEventListener('click', e => {
  const btn = e.target.closest('.style-btn');
  if (!btn) return;
  pendingTimerStyle = btn.dataset.style;
  $styleOptions.querySelectorAll('.style-btn').forEach(b => b.classList.toggle('selected', b === btn));
});

function applyTimerStyle(style) {
  document.querySelector('.timer-card').classList.toggle('timer-minimal', style === 'minimal');
}

// ─── Focus Mode ──────────────────────────────────────────────────────────────

$focusModeBtn.addEventListener('click', () => {
  focusModeActive = !focusModeActive;
  document.querySelector('.app').classList.toggle('focus-mode', focusModeActive);
  $focusModeBtn.textContent = focusModeActive ? 'Exit Focus' : 'Focus Mode';
  $focusModeBtn.classList.toggle('active', focusModeActive);
});

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
