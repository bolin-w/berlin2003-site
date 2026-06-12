(function(){
"use strict";
const STORAGE_KEY = "berlin2003_life_diary_v1";
const AUTH_KEY = "berlin2003_ai_auth";
const API_BASE = "/api/editor/notes";
const PAGE_PATH = "/life/";
const CATEGORIES = [
  { id: "daily", noteId: "block-0-0", label: "日常生活" },
  { id: "gratitude", noteId: "block-0-1", label: "感恩日记" },
  { id: "travel", noteId: "block-0-2", label: "旅行记录" },
  { id: "dream", noteId: "block-0-3", label: "梦境日志" }
];

let state = {
  category: "daily",
  connected: false,
  entries: loadLocal(),
  selectedMood: "",
  syncing: false,
  editingId: null
};

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch(e) { return {}; }
}
function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}
function loadAuth() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)) || {}; }
  catch(e) { return {}; }
}
function saveAuth(a) { sessionStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function clearAuth() { sessionStorage.removeItem(AUTH_KEY); }
function authHeader() {
  const a = loadAuth();
  if (!a.username || !a.password) return {};
  return { Authorization: "Basic " + btoa(a.username + ":" + a.password) };
}

function currentNoteId() {
  return CATEGORIES.find(c => c.id === state.category)?.noteId || "block-0-0";
}
function currentEntries() {
  return state.entries[currentNoteId()] || [];
}
function setEntries(noteId, entries) {
  state.entries[noteId] = entries;
  saveLocal();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff/60000) + " 分钟前";
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return "今天 " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) {
    return "昨天 " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) + " " +
    d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function dateGroup(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "今天";
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
}

// === SERIALIZATION (entries <-> HTML for API compatibility) ===
function entriesToContent(entries) {
  return JSON.stringify(entries);
}
function contentToEntries(content) {
  if (!content) return [];
  const trimmed = content.trim();
  if (trimmed.startsWith("[")) {
    try { return JSON.parse(trimmed); } catch(e) {}
  }
  if (trimmed) {
    return [{ id: generateId(), date: new Date().toISOString(), mood: "", content: trimmed }];
  }
  return [];
}

// === RENDER ===
function renderTimeline() {
  const timeline = document.getElementById("life-timeline");
  const entries = currentEntries();
  if (!entries.length) {
    timeline.innerHTML = '<div class="life-empty"><span class="life-empty-icon">📖</span><p>还没有日记，点击「写新日记」开始记录吧</p></div>';
    return;
  }
  let html = "";
  let lastGroup = "";
  const sorted = [...entries].sort((a,b) => new Date(b.date) - new Date(a.date));
  for (const entry of sorted) {
    const group = dateGroup(entry.date);
    if (group !== lastGroup) {
      html += '<div class="life-date-divider"><span>' + group + '</span></div>';
      lastGroup = group;
    }
    html += renderEntry(entry);
  }
  timeline.innerHTML = html;
  timeline.querySelectorAll(".life-entry-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });
  timeline.querySelectorAll(".life-entry-edit").forEach(btn => {
    btn.addEventListener("click", () => editEntry(btn.dataset.id));
  });
}

function renderEntry(entry) {
  const mood = entry.mood ? '<span class="life-entry-mood">' + moodEmoji(entry.mood) + '</span>' : '';
  const title = entry.title ? '<h3 class="life-entry-title">' + sanitizeText(entry.title) + '</h3>' : '';
  return '<article class="life-entry" data-id="' + entry.id + '">' +
    '<div class="life-entry-head">' +
      '<span class="life-entry-date">' + mood + formatDate(entry.date) + '</span>' +
      '<div class="life-entry-actions">' +
        '<button class="life-entry-action life-entry-edit" data-id="' + entry.id + '" title="编辑">✏️</button>' +
        '<button class="life-entry-action life-entry-delete" data-id="' + entry.id + '" title="删除">🗑️</button>' +
      '</div>' +
    '</div>' +
    title +
    '<div class="life-entry-content">' + sanitize(entry.content) + '</div>' +
  '</article>';
}

function moodEmoji(mood) {
  const map = { happy:"😊", love:"🥰", calm:"😌", sad:"😢", angry:"😤" };
  return map[mood] || "";
}

function sanitize(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  div.querySelectorAll("script,style,iframe,object,embed").forEach(el => el.remove());
  return div.innerHTML;
}

function updateCounts() {
  CATEGORIES.forEach(cat => {
    const el = document.getElementById(cat.id + "-count");
    const count = (state.entries[cat.noteId] || []).length;
    if (el) el.textContent = count + " 篇";
  });
  updateWidgets();
  updateEntriesList();
}

function updateEntriesList() {
  CATEGORIES.forEach(cat => {
    const container = document.getElementById(cat.id + "-entries");
    if (!container) return;

    const entries = state.entries[cat.noteId] || [];
    if (!entries.length) {
      container.innerHTML = '<div class="life-entries-empty">暂无日记</div>';
      return;
    }

    const sorted = [...entries].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    let html = '';

    for (const entry of sorted) {
      const title = entry.title || extractTitle(entry.content);
      const dateStr = formatShortDate(entry.date);
      const mood = entry.mood ? moodEmoji(entry.mood) : '';

      html += '<button type="button" class="life-entry-nav" data-entry-id="' + entry.id + '">' +
        '<div class="life-entry-nav-head">' +
          (mood ? '<span class="life-entry-nav-mood">' + mood + '</span>' : '') +
          '<span class="life-entry-nav-date">' + dateStr + '</span>' +
        '</div>' +
        '<div class="life-entry-nav-title">' + sanitizeText(title) + '</div>' +
      '</button>';
    }

    container.innerHTML = html;

    container.querySelectorAll(".life-entry-nav").forEach(btn => {
      btn.addEventListener("click", () => scrollToEntry(btn.dataset.entryId));
    });
  });
}

function sanitizeText(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function extractTitle(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent.trim();
  const firstLine = text.split('\n')[0];
  return firstLine.slice(0, 30) || "无标题";
}

function extractPreview(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent.trim();
  const lines = text.split('\n');
  const preview = lines.length > 1 ? lines.slice(1).join(' ') : '';
  return preview.slice(0, 40);
}

function formatShortDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "今天";
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "昨天";
  return (d.getMonth()+1) + '/' + d.getDate();
}

function scrollToEntry(id) {
  const el = document.querySelector('.life-entry[data-id="' + id + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.animation = 'none';
    setTimeout(() => {
      el.style.animation = 'entry-highlight .6s ease';
    }, 10);
  }
}

function updateWidgets() {
  // Today's date
  const dateEl = document.getElementById("life-widget-date");
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "short"
    });
  }

  // Total entries across all categories
  const totalEl = document.getElementById("life-total-entries");
  if (totalEl) {
    const total = Object.values(state.entries).reduce((sum, arr) => sum + arr.length, 0);
    totalEl.textContent = total;
  }

  // Streak calculation
  const streakEl = document.getElementById("life-streak-days");
  if (streakEl) {
    const streak = calculateStreak();
    streakEl.textContent = streak;
  }
}

function calculateStreak() {
  const allEntries = [];
  Object.values(state.entries).forEach(arr => allEntries.push(...arr));
  if (!allEntries.length) return 0;

  const dates = allEntries
    .map(e => new Date(e.date).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  if (dates[0] !== today && dates[0] !== yesterdayStr) return 0;

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toDateString()) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function updateSyncBar() {
  const bar = document.getElementById("life-sync-bar");
  if (!state.connected) {
    bar.hidden = true;
    return;
  }
  // Only show if there are local entries that might need syncing
  const hasLocal = Object.values(state.entries).some(arr => arr && arr.length > 0);
  bar.hidden = !hasLocal;
  if (hasLocal) {
    document.getElementById("life-sync-status").textContent = "有本地草稿，可同步到服务器";
  }
}

// === ACTIONS ===
function showComposer() {
  const composer = document.getElementById("life-composer");
  composer.hidden = false;
  const dateEl = document.getElementById("life-composer-date");
  dateEl.textContent = new Date().toLocaleDateString("zh-CN", { year:"numeric", month:"long", day:"numeric", weekday:"short" });
  document.getElementById("life-composer-input").focus();
  state.selectedMood = "";
  state.editingId = null;
  document.querySelectorAll(".life-mood").forEach(m => m.classList.remove("is-selected"));
}

function hideComposer() {
  document.getElementById("life-composer").hidden = true;
  document.getElementById("life-composer-title").value = "";
  document.getElementById("life-composer-input").innerHTML = "";
  state.selectedMood = "";
  state.editingId = null;
}

function saveEntry() {
  const titleInput = document.getElementById("life-composer-title");
  const input = document.getElementById("life-composer-input");
  const title = titleInput.value.trim();
  const content = input.innerHTML.trim();
  if (!content) return;

  const noteId = currentNoteId();
  let entries = [...currentEntries()];

  if (state.editingId) {
    // Update existing entry
    const idx = entries.findIndex(e => e.id === state.editingId);
    if (idx >= 0) {
      entries[idx] = {
        ...entries[idx],
        title: title,
        mood: state.selectedMood,
        content: content
      };
    }
  } else {
    // Create new entry
    const entry = {
      id: generateId(),
      date: new Date().toISOString(),
      title: title,
      mood: state.selectedMood,
      content: content
    };
    entries.push(entry);
  }

  setEntries(noteId, entries);
  hideComposer();
  renderTimeline();
  updateCounts();
  updateSyncBar();
}

function deleteEntry(id) {
  if (!confirm("确定删除这条日记吗？")) return;
  const noteId = currentNoteId();
  const entries = currentEntries().filter(e => e.id !== id);
  setEntries(noteId, entries);
  renderTimeline();
  updateCounts();
  updateSyncBar();
}

function editEntry(id) {
  const entry = currentEntries().find(e => e.id === id);
  if (!entry) return;
  state.editingId = id;
  showComposer();
  document.getElementById("life-composer-title").value = entry.title || "";
  document.getElementById("life-composer-input").innerHTML = entry.content;
  if (entry.mood) {
    state.selectedMood = entry.mood;
    document.querySelectorAll(".life-mood").forEach(m => {
      m.classList.toggle("is-selected", m.dataset.mood === entry.mood);
    });
  }
}

function deleteEntryQuiet(id) {
  const noteId = currentNoteId();
  const entries = currentEntries().filter(e => e.id !== id);
  setEntries(noteId, entries);
}

// === SYNC ===
async function connect() {
  const user = document.getElementById("note-auth-user").value.trim();
  const pass = document.getElementById("note-auth-pass").value.trim();
  if (!user || !pass) { setStatus("请输入用户名和密码", "warn"); return; }
  saveAuth({ username: user, password: pass });
  setStatus("连接中...", "");
  try {
    const res = await fetch(API_BASE + "?pagePath=" + encodeURIComponent(PAGE_PATH), {
      headers: { Accept: "application/json", ...authHeader() }
    });
    if (!res.ok) throw new Error(res.status === 401 ? "密码错误" : "连接失败");
    const data = await res.json();
    state.connected = true;
    if (data.notes) {
      for (const cat of CATEGORIES) {
        const remote = data.notes[cat.noteId];
        if (remote && remote.content) {
          const remoteEntries = contentToEntries(remote.content);
          const localEntries = state.entries[cat.noteId] || [];
          state.entries[cat.noteId] = mergeEntries(localEntries, remoteEntries);
        }
      }
      saveLocal();
    }
    setStatus("已连接 ✓", "ok");
    renderTimeline();
    updateCounts();
    updateSyncBar();
  } catch(e) {
    state.connected = false;
    setStatus(e.message, "warn");
  }
}

function mergeEntries(local, remote) {
  const map = new Map();
  for (const e of remote) map.set(e.id, e);
  for (const e of local) map.set(e.id, e);
  return [...map.values()].sort((a,b) => new Date(b.date) - new Date(a.date));
}

function disconnect() {
  state.connected = false;
  clearAuth();
  document.getElementById("note-auth-pass").value = "";
  setStatus("已断开", "");
  updateSyncBar();
}

async function syncAll() {
  if (!state.connected || state.syncing) return;
  state.syncing = true;
  document.getElementById("life-sync-status").textContent = "同步中...";
  try {
    for (const cat of CATEGORIES) {
      const entries = state.entries[cat.noteId] || [];
      await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeader() },
        body: JSON.stringify({ pagePath: PAGE_PATH, noteId: cat.noteId, label: cat.label, content: entriesToContent(entries) })
      });
    }
    setStatus("同步完成 ✓", "ok");
    document.getElementById("life-sync-status").textContent = "已同步";
  } catch(e) {
    setStatus("同步失败: " + e.message, "warn");
  } finally {
    state.syncing = false;
  }
}

function setStatus(text, mode) {
  const el = document.getElementById("note-auth-status");
  el.textContent = text;
  el.dataset.mode = mode || "";
}

// === CATEGORY SWITCH ===
function switchCategory(catId) {
  state.category = catId;
  document.querySelectorAll(".life-nav-item").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.category === catId);
  });
  // Show/hide entries lists
  document.querySelectorAll(".life-nav-entries").forEach(list => {
    const listCat = list.id.replace("-entries", "");
    list.hidden = listCat !== catId;
  });
  const cat = CATEGORIES.find(c => c.id === catId);
  document.getElementById("life-category-title").textContent = cat ? cat.label : "";
  hideComposer();
  renderTimeline();
}

// === IMAGE INSERT ===
function insertImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.src = reader.result;
      const input = document.getElementById("life-composer-input");
      input.focus();
      const sel = window.getSelection();
      const range = sel.rangeCount ? sel.getRangeAt(0) : document.createRange();
      if (!input.contains(range.startContainer)) {
        range.selectNodeContents(input);
        range.collapse(false);
      }
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

// === INIT ===
function init() {
  document.getElementById("note-auth-connect").addEventListener("click", connect);
  document.getElementById("note-auth-disconnect").addEventListener("click", disconnect);
  document.getElementById("note-auth-pass").addEventListener("keydown", e => { if(e.key==="Enter") connect(); });
  document.getElementById("life-new-entry").addEventListener("click", showComposer);
  document.getElementById("life-composer-cancel").addEventListener("click", hideComposer);
  document.getElementById("life-composer-save").addEventListener("click", saveEntry);
  document.getElementById("life-sync-btn").addEventListener("click", syncAll);

  document.querySelectorAll(".life-mood").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mood = btn.dataset.mood;
      document.querySelectorAll(".life-mood").forEach(m => m.classList.remove("is-selected"));
      if (state.selectedMood === mood) {
        state.selectedMood = "";
      } else {
        state.selectedMood = mood;
        btn.classList.add("is-selected");
      }
    });
  });

  document.querySelectorAll(".life-nav-item").forEach(btn => {
    btn.addEventListener("click", () => switchCategory(btn.dataset.category));
  });

  document.getElementById("life-composer-add-image").addEventListener("click", () => {
    document.getElementById("life-composer-image-picker").click();
  });
  document.getElementById("life-composer-image-picker").addEventListener("change", async (e) => {
    for (const file of e.target.files) { if(file.type.startsWith("image/")) await insertImage(file); }
    e.target.value = "";
  });

  const auth = loadAuth();
  if (auth.username) document.getElementById("note-auth-user").value = auth.username;
  if (auth.password) document.getElementById("note-auth-pass").value = auth.password;

  renderTimeline();
  updateCounts();
  updateSyncBar();
}

init();
})();
