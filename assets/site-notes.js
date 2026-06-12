const NOTE_AUTH_STORAGE_KEY = "berlin2003_ai_auth";
const NOTE_DRAFT_STORAGE_KEY = "berlin2003_life_drafts_v2";
const NOTE_IMAGE_MAX_EDGE = 1600;
const NOTE_IMAGE_QUALITY = 0.82;
const NOTE_IMAGE_MAX_DATA_URL_LENGTH = 1_600_000;
const isLifePage = window.location.pathname.startsWith("/life/");
const currentPagePath = normalizePagePath(window.location.pathname);

const noteState = {
  auth: loadAuth(),
  connected: false,
  loading: false,
  syncing: false,
  syncArmed: false,
  lastDraftPersistFailed: false,
  remoteNotesById: {},
  localDraftsById: loadDraftsForPage(currentPagePath),
  collections: [],
  activeNoteId: "block-0-0",
  ui: null
};

function normalizePagePath(pathname) {
  const clean = String(pathname || "/").split("?")[0].split("#")[0].trim();
  if (!clean || clean === "/") {
    return "/";
  }

  return `${clean.replace(/\/+$/, "")}/`;
}

function loadAuth() {
  try {
    const raw = sessionStorage.getItem(NOTE_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { username: "berlin2003", password: "" };
  } catch (_error) {
    return { username: "berlin2003", password: "" };
  }
}

function saveAuth(auth) {
  noteState.auth = auth;
  sessionStorage.setItem(NOTE_AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  noteState.auth = { username: "berlin2003", password: "" };
  sessionStorage.removeItem(NOTE_AUTH_STORAGE_KEY);
}

function loadDraftStore() {
  try {
    const raw = localStorage.getItem(NOTE_DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function writeDraftStore(store) {
  localStorage.setItem(NOTE_DRAFT_STORAGE_KEY, JSON.stringify(store));
}

function loadDraftsForPage(pagePath) {
  const store = loadDraftStore();
  const drafts = store[pagePath];
  return drafts && typeof drafts === "object" ? drafts : {};
}

function persistDrafts() {
  try {
    const store = loadDraftStore();
    if (Object.keys(noteState.localDraftsById).length > 0) {
      store[currentPagePath] = noteState.localDraftsById;
    } else {
      delete store[currentPagePath];
    }
    writeDraftStore(store);
    noteState.lastDraftPersistFailed = false;
    return true;
  } catch (_error) {
    noteState.lastDraftPersistFailed = true;
    setAuthStatus("本地草稿空间不足，请先同步到服务器，或减少当前图片数量。", "warn");
    return false;
  }
}

function authHeader() {
  if (!noteState.auth?.username || !noteState.auth?.password) {
    return {};
  }

  return {
    Authorization: "Basic " + btoa(`${noteState.auth.username}:${noteState.auth.password}`)
  };
}

async function readApiPayload(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      error: text.slice(0, 160)
    };
  }
}

function currentTimeLabel(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sanitizeHref(href) {
  const value = String(href || "").trim();
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("/")) {
    return value;
  }

  return "";
}

function sanitizeImageNode(node) {
  const src = String(node.getAttribute("src") || "").trim();
  if (!src || !/^(data:image\/|https?:\/\/|\/)/i.test(src)) {
    return null;
  }

  const img = document.createElement("img");
  img.src = src;
  img.alt = String(node.getAttribute("alt") || "插入图片").trim().slice(0, 200) || "插入图片";
  img.loading = "lazy";
  return img;
}

function appendSanitizedChildren(source, target) {
  [...source.childNodes].forEach((child) => appendSanitizedNode(child, target));
}

function sanitizeFigureNode(node) {
  const figure = document.createElement("figure");
  figure.className = "life-note-figure";

  [...node.querySelectorAll("img")].forEach((child) => {
    const sanitizedImage = sanitizeImageNode(child);
    if (sanitizedImage) {
      figure.appendChild(sanitizedImage);
    }
  });

  return figure.childNodes.length ? figure : null;
}

function appendSanitizedNode(node, target) {
  if (node.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(node.textContent || ""));
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tag = node.tagName.toUpperCase();

  if (tag === "BR") {
    target.appendChild(document.createElement("br"));
    return;
  }

  if (tag === "IMG") {
    const sanitizedImage = sanitizeImageNode(node);
    if (sanitizedImage) {
      target.appendChild(sanitizedImage);
    }
    return;
  }

  if (tag === "FIGURE") {
    const figure = sanitizeFigureNode(node);
    if (figure) {
      target.appendChild(figure);
    }
    return;
  }

  if (tag === "DIV" || tag === "P") {
    const block = document.createElement("div");
    appendSanitizedChildren(node, block);
    if (block.childNodes.length) {
      target.appendChild(block);
    }
    return;
  }

  if (tag === "STRONG" || tag === "B") {
    const strong = document.createElement("strong");
    appendSanitizedChildren(node, strong);
    if (strong.childNodes.length) {
      target.appendChild(strong);
    }
    return;
  }

  if (tag === "EM" || tag === "I") {
    const em = document.createElement("em");
    appendSanitizedChildren(node, em);
    if (em.childNodes.length) {
      target.appendChild(em);
    }
    return;
  }

  if (tag === "A") {
    const href = sanitizeHref(node.getAttribute("href"));
    if (href) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noreferrer noopener";
      appendSanitizedChildren(node, anchor);
      if (anchor.textContent.trim()) {
        target.appendChild(anchor);
      }
      return;
    }
  }

  appendSanitizedChildren(node, target);
}

function sanitizeNoteHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");

  const output = document.createElement("div");
  appendSanitizedChildren(template.content, output);

  const normalized = output.innerHTML
    .replace(/<div><br><\/div>/gi, "<br>")
    .replace(/(?:<br>\s*){3,}/gi, "<br><br>")
    .trim();

  return hasMeaningfulContent(normalized) ? normalized : "";
}

function rawHtmlFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  return template.content;
}

function plainTextFromHtml(html) {
  const fragment = rawHtmlFragment(html);
  return (fragment.textContent || "").replace(/\s+/g, " ").trim();
}

function countImagesInHtml(html) {
  const fragment = rawHtmlFragment(html);
  return fragment.querySelectorAll("img").length;
}

function hasMeaningfulContent(html) {
  if (!html) {
    return false;
  }

  return Boolean(plainTextFromHtml(html)) || countImagesInHtml(html) > 0;
}

function noteStats(html) {
  const text = plainTextFromHtml(html);
  return {
    chars: text.length,
    images: countImagesInHtml(html)
  };
}

function previewText(content) {
  const text = plainTextFromHtml(content);
  const imageCount = countImagesInHtml(content);

  if (!text && imageCount) {
    return imageCount === 1 ? "1 张图片" : `${imageCount} 张图片`;
  }

  if (!text) {
    return "这一栏还没有内容";
  }

  const short = text.length > 34 ? `${text.slice(0, 34)}…` : text;
  return imageCount ? `${short} · ${imageCount} 图` : short;
}

function activeCollection() {
  return noteState.collections.find((item) => item.noteId === noteState.activeNoteId) || noteState.collections[0];
}

function activeNote() {
  const collection = activeCollection();
  if (!collection) {
    return null;
  }

  return noteState.localDraftsById[collection.noteId] || noteState.remoteNotesById[collection.noteId] || null;
}

function dirtyDraftCount() {
  return Object.keys(noteState.localDraftsById).length;
}

function setAuthStatus(text, mode = "") {
  const status = document.querySelector("#note-auth-status");
  if (!status) {
    return;
  }

  status.textContent = text;
  status.dataset.mode = mode;
}

function updateCollectionCard(collection) {
  const localDraft = noteState.localDraftsById[collection.noteId];
  const remoteNote = noteState.remoteNotesById[collection.noteId];
  const note = localDraft || remoteNote;

  if (localDraft) {
    collection.meta.textContent = "本地草稿";
    collection.preview.textContent = previewText(localDraft.content || "");
    return;
  }

  if (noteState.connected) {
    collection.meta.textContent = remoteNote?.updatedAt ? currentTimeLabel(remoteNote.updatedAt) : "还没有内容";
    collection.preview.textContent = previewText(remoteNote?.content || "");
    return;
  }

  if (remoteNote) {
    collection.meta.textContent = "离线浏览";
    collection.preview.textContent = previewText(remoteNote.content || "");
    return;
  }

  collection.meta.textContent = "未连接";
  collection.preview.textContent = "内容先保存在本地草稿里";
}

function updateAllCollections() {
  noteState.collections.forEach(updateCollectionCard);
}

function setEditorContent(html) {
  const ui = noteState.ui;
  if (!ui) {
    return;
  }

  ui.input.innerHTML = sanitizeNoteHtml(html);
}

function readEditorContent() {
  const ui = noteState.ui;
  if (!ui) {
    return "";
  }

  return sanitizeNoteHtml(ui.input.innerHTML);
}

function updateActionButtons() {
  const ui = noteState.ui;
  if (!ui) {
    return;
  }

  const drafts = dirtyDraftCount();
  ui.sync.disabled = !noteState.connected || noteState.syncing || drafts === 0;
  ui.sync.textContent = noteState.syncing
    ? "同步中..."
    : drafts > 1
      ? `同步到服务器 (${drafts})`
      : "同步到服务器";

  ui.insertImage.disabled = false;
  ui.clear.disabled = noteState.syncing;
}

function updateEditorMeta({ stateText, updatedAt = "", mode = "idle", editable = true }) {
  const ui = noteState.ui;
  if (!ui) {
    return;
  }

  const stats = noteStats(readEditorContent());
  const time = currentTimeLabel(updatedAt);

  ui.shell.dataset.noteDisabled = editable ? "false" : "true";
  ui.input.contentEditable = editable ? "true" : "false";
  ui.input.setAttribute("aria-disabled", editable ? "false" : "true");
  ui.count.textContent = stats.images ? `${stats.chars} 字 · ${stats.images} 图` : `${stats.chars} 字`;
  ui.state.textContent = time ? `${stateText} · ${time}` : stateText;
  ui.dot.dataset.mode = mode;
  updateActionButtons();
}

function renderActiveEditor(overrideStateText = "", overrideMode = "") {
  const ui = noteState.ui;
  const collection = activeCollection();
  if (!ui || !collection) {
    return;
  }

  const localDraft = noteState.localDraftsById[collection.noteId];
  const remoteNote = noteState.remoteNotesById[collection.noteId];
  const note = localDraft || remoteNote;

  noteState.activeNoteId = collection.noteId;
  noteState.collections.forEach((item) => {
    item.button.classList.toggle("is-active", item.noteId === collection.noteId);
  });

  ui.kicker.textContent = collection.kicker;
  ui.title.textContent = collection.label;
  ui.description.textContent = collection.description;
  ui.input.dataset.placeholder = collection.placeholder;
  setEditorContent(note?.content || "");

  let stateText = "未连接，当前内容只保存在本地";
  let updatedAt = "";
  let mode = "idle";

  if (localDraft) {
    stateText = noteState.connected ? "本地草稿未同步到服务器" : "当前内容仅保存在本地";
    updatedAt = localDraft.updatedAt || "";
    mode = "warn";
  } else if (noteState.loading) {
    stateText = "正在连接服务器...";
    mode = "saving";
  } else if (noteState.connected) {
    stateText = remoteNote?.content ? "已与服务器同步" : "这一栏还没有内容";
    updatedAt = remoteNote?.updatedAt || "";
    mode = "ok";
  } else if (remoteNote?.content) {
    stateText = "未连接，当前显示上次载入内容";
  }

  updateEditorMeta({
    stateText: overrideStateText || stateText,
    updatedAt,
    mode: overrideMode || mode,
    editable: true
  });
}

function upsertLocalDraft(noteId, label, content) {
  const sanitizedContent = sanitizeNoteHtml(content);
  const remoteContent = sanitizeNoteHtml(noteState.remoteNotesById[noteId]?.content || "");

  if (!hasMeaningfulContent(sanitizedContent) && !hasMeaningfulContent(remoteContent)) {
    delete noteState.localDraftsById[noteId];
    persistDrafts();
    return null;
  }

  if (sanitizedContent === remoteContent) {
    delete noteState.localDraftsById[noteId];
    persistDrafts();
    return null;
  }

  const draft = {
    noteId,
    label,
    content: sanitizedContent,
    updatedAt: new Date().toISOString(),
    dirty: true
  };

  noteState.localDraftsById[noteId] = draft;
  persistDrafts();
  return draft;
}

function refreshAuthStatusFromState() {
  if (noteState.lastDraftPersistFailed) {
    return;
  }

  const drafts = dirtyDraftCount();

  if (noteState.syncing) {
    return;
  }

  if (noteState.connected) {
    if (drafts > 0) {
      setAuthStatus(`已连接。当前有 ${drafts} 条本地草稿待同步到服务器。`, "");
      return;
    }

    setAuthStatus("已连接。当前本地内容与服务器一致。", "ok");
    return;
  }

  if (drafts > 0) {
    setAuthStatus(`未连接。当前有 ${drafts} 条本地草稿保存在浏览器里。`, "");
    return;
  }

  setAuthStatus("未连接。可以先写本地草稿，之后再手动同步到服务器。", "");
}

function persistActiveDraft(customStateText = "") {
  const collection = activeCollection();
  if (!collection) {
    return;
  }

  const content = readEditorContent();
  const draft = upsertLocalDraft(collection.noteId, collection.label, content);
  updateAllCollections();

  if (!draft) {
    renderActiveEditor();
    refreshAuthStatusFromState();
    return;
  }

  updateEditorMeta({
    stateText: customStateText || (noteState.connected ? "已保存到本地草稿，待同步服务器" : "已保存到本地草稿"),
    updatedAt: draft.updatedAt,
    mode: "warn",
    editable: true
  });

  refreshAuthStatusFromState();
}

function applyRemoteNotes(notes) {
  const normalized = {};

  for (const [noteId, note] of Object.entries(notes || {})) {
    normalized[noteId] = {
      noteId,
      label: String(note?.label || "").trim(),
      content: sanitizeNoteHtml(note?.content || ""),
      updatedAt: note?.updatedAt || ""
    };
  }

  noteState.remoteNotesById = normalized;
  updateAllCollections();
  renderActiveEditor();
}

async function saveNoteToServer(noteId, label, content) {
  const response = await fetch("/api/editor/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader()
    },
    body: JSON.stringify({
      pagePath: currentPagePath,
      noteId,
      label,
      content
    })
  });

  const data = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(response.status === 401 ? "登录已失效，请重新连接。" : (data.error || "同步失败。"));
  }

  if (data.note) {
    noteState.remoteNotesById[noteId] = {
      noteId,
      label: data.note.label || label,
      content: sanitizeNoteHtml(data.note.content || content),
      updatedAt: data.note.updatedAt || new Date().toISOString()
    };
  } else {
    delete noteState.remoteNotesById[noteId];
  }

  delete noteState.localDraftsById[noteId];
  persistDrafts();
}

async function syncDrafts() {
  if (!noteState.syncArmed) {
    setAuthStatus("只有点击“同步到服务器”后，才会把本地草稿写到服务器。", "");
    return;
  }

  noteState.syncArmed = false;

  if (!noteState.connected) {
    setAuthStatus("先连接账号，再把本地草稿同步到服务器。", "warn");
    return;
  }

  const drafts = noteState.collections
    .map((collection) => noteState.localDraftsById[collection.noteId])
    .filter(Boolean);

  if (drafts.length === 0) {
    setAuthStatus("当前没有待同步的本地草稿。", "");
    return;
  }

  noteState.syncing = true;
  updateEditorMeta({
    stateText: drafts.length > 1 ? `正在同步 ${drafts.length} 条草稿到服务器...` : "正在同步到服务器...",
    mode: "saving",
    editable: true
  });
  setAuthStatus(`正在同步 ${drafts.length} 条本地草稿到服务器...`, "");

  let syncedCount = 0;

  try {
    for (const draft of drafts) {
      await saveNoteToServer(draft.noteId, draft.label, draft.content);
      syncedCount += 1;
    }

    setAuthStatus(`已完成同步，共写入 ${syncedCount} 条草稿。`, "ok");
  } catch (error) {
    setAuthStatus(error.message || `同步在第 ${syncedCount + 1} 条草稿时失败。`, "warn");
  } finally {
    noteState.syncing = false;
    updateAllCollections();
    renderActiveEditor();
    refreshAuthStatusFromState();
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片解析失败。"));
    image.src = src;
  });
}

async function compressImageFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);

  if (file.type === "image/gif") {
    return originalDataUrl;
  }

  const image = await loadImageElement(originalDataUrl);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestEdge > NOTE_IMAGE_MAX_EDGE ? NOTE_IMAGE_MAX_EDGE / longestEdge : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let dataUrl = canvas.toDataURL("image/webp", NOTE_IMAGE_QUALITY);
  if (!dataUrl || dataUrl === "data:,") {
    return originalDataUrl;
  }

  if (dataUrl.length > NOTE_IMAGE_MAX_DATA_URL_LENGTH) {
    dataUrl = canvas.toDataURL("image/webp", 0.72);
  }

  return dataUrl.length < originalDataUrl.length ? dataUrl : originalDataUrl;
}

function ensureEditorRange() {
  const ui = noteState.ui;
  if (!ui) {
    return null;
  }

  ui.input.focus();

  const selection = window.getSelection();
  if (!selection) {
    return null;
  }

  if (!selection.rangeCount || !ui.input.contains(selection.anchorNode)) {
    const range = document.createRange();
    range.selectNodeContents(ui.input);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  }

  return selection.getRangeAt(0);
}

function insertFragmentAtCaret(fragment) {
  const range = ensureEditorRange();
  if (!range) {
    return;
  }

  const lastNode = fragment.lastChild;
  range.deleteContents();
  range.insertNode(fragment);

  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

function textFragment(text) {
  const fragment = document.createDocumentFragment();
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  lines.forEach((line, index) => {
    if (line) {
      fragment.appendChild(document.createTextNode(line));
    }

    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });

  return fragment;
}

function insertTextAtCaret(text) {
  insertFragmentAtCaret(textFragment(text));
}

function imageFigure(src, alt = "插入图片") {
  const figure = document.createElement("figure");
  figure.className = "life-note-figure";

  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  figure.appendChild(img);

  return figure;
}

function insertImageAtCaret(src, alt) {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(imageFigure(src, alt));
  fragment.appendChild(document.createElement("br"));
  insertFragmentAtCaret(fragment);
}

async function insertImagesFromFiles(fileList) {
  const files = [...fileList].filter((file) => file && /^image\//i.test(file.type));
  if (!files.length) {
    return;
  }

  updateEditorMeta({
    stateText: "正在处理图片并写入本地草稿...",
    mode: "saving",
    editable: true
  });

  try {
    for (const file of files) {
      const dataUrl = await compressImageFile(file);
      insertImageAtCaret(dataUrl, file.name.replace(/\.[^.]+$/, "") || "插入图片");
    }

    persistActiveDraft(noteState.connected ? "图片已插入，本地草稿待同步" : "图片已插入，本地草稿已保存");
  } catch (error) {
    setAuthStatus(error.message || "图片插入失败。", "warn");
    renderActiveEditor();
  }
}

async function connectNotes() {
  const username = document.querySelector("#note-auth-user")?.value.trim();
  const password = document.querySelector("#note-auth-pass")?.value.trim();

  if (!username || !password) {
    setAuthStatus("先输入用户名和密码。", "warn");
    return;
  }

  saveAuth({ username, password });
  noteState.loading = true;
  setAuthStatus("正在连接并读取服务器上的私密笔记...", "");
  updateEditorMeta({
    stateText: "正在连接服务器...",
    mode: "saving",
    editable: true
  });

  try {
    const response = await fetch(`/api/editor/notes?pagePath=${encodeURIComponent(currentPagePath)}`, {
      headers: {
        Accept: "application/json",
        ...authHeader()
      }
    });

    const data = await readApiPayload(response);
    if (!response.ok) {
      throw new Error(response.status === 401 ? "连接失败，请检查账号密码。" : (data.error || "连接失败，请检查账号密码。"));
    }

    noteState.connected = true;
    applyRemoteNotes(data.notes || {});
    refreshAuthStatusFromState();
  } catch (error) {
    noteState.connected = false;
    setAuthStatus(error.message || "连接失败，请检查账号密码。", "warn");
    renderActiveEditor();
  } finally {
    noteState.loading = false;
    renderActiveEditor();
  }
}

function disconnectNotes() {
  noteState.connected = false;
  clearAuth();

  const user = document.querySelector("#note-auth-user");
  const pass = document.querySelector("#note-auth-pass");
  if (user) {
    user.value = "berlin2003";
  }
  if (pass) {
    pass.value = "";
  }

  setAuthStatus("已断开。你仍可继续写本地草稿，之后重新连接再同步。", "");
  updateAllCollections();
  renderActiveEditor();
}

function hasImageItems(items) {
  return [...items].some((item) => item?.type && /^image\//i.test(item.type));
}

function bindLifeNotes() {
  const shell = document.querySelector("[data-life-app]");
  if (!shell || shell.dataset.bound === "true") {
    return;
  }

  shell.dataset.bound = "true";

  const ui = {
    shell: document.querySelector("[data-note-shell]"),
    input: document.querySelector("#life-editor-input"),
    count: document.querySelector("#life-editor-count"),
    state: document.querySelector("#life-editor-state"),
    dot: document.querySelector("#life-editor-dot"),
    kicker: document.querySelector("#life-editor-kicker"),
    title: document.querySelector("#life-editor-title"),
    description: document.querySelector("#life-editor-description"),
    clear: document.querySelector("#life-editor-clear"),
    sync: document.querySelector("#life-editor-sync"),
    insertImage: document.querySelector("#life-editor-insert-image"),
    imagePicker: document.querySelector("#life-editor-image-picker")
  };

  noteState.ui = ui;
  noteState.collections = [...document.querySelectorAll(".life-collection")].map((button) => ({
    button,
    noteId: button.dataset.noteId,
    label: button.dataset.noteLabel,
    kicker: button.dataset.noteKicker,
    description: button.dataset.noteDescription,
    placeholder: button.dataset.notePlaceholder,
    meta: button.querySelector(".life-collection-meta"),
    preview: button.querySelector(".life-collection-preview")
  }));

  noteState.collections.forEach((collection) => {
    collection.button.addEventListener("click", () => {
      noteState.activeNoteId = collection.noteId;
      renderActiveEditor();
    });
  });

  ui.clear.addEventListener("click", () => {
    ui.input.innerHTML = "";
    persistActiveDraft(noteState.connected ? "当前页已清空，本地草稿待同步" : "当前页已清空，本地草稿已保存");
    ui.input.focus();
  });

  ui.sync.addEventListener("click", () => {
    noteState.syncArmed = true;
    void syncDrafts();
  });

  ui.insertImage.addEventListener("click", () => {
    ui.imagePicker.click();
  });

  ui.imagePicker.addEventListener("change", () => {
    void insertImagesFromFiles(ui.imagePicker.files || []);
    ui.imagePicker.value = "";
  });

  ui.input.addEventListener("input", () => {
    persistActiveDraft();
  });

  ui.input.addEventListener("paste", (event) => {
    const clipboardItems = [...(event.clipboardData?.items || [])];

    if (hasImageItems(clipboardItems)) {
      event.preventDefault();
      const files = clipboardItems
        .filter((item) => /^image\//i.test(item.type))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      void insertImagesFromFiles(files);
      return;
    }

    const text = event.clipboardData?.getData("text/plain");
    if (typeof text === "string") {
      event.preventDefault();
      insertTextAtCaret(text);
      persistActiveDraft();
    }
  });

  ui.input.addEventListener("dragover", (event) => {
    if (hasImageItems(event.dataTransfer?.items || [])) {
      event.preventDefault();
      ui.shell.dataset.drop = "over";
    }
  });

  ui.input.addEventListener("dragleave", () => {
    delete ui.shell.dataset.drop;
  });

  ui.input.addEventListener("drop", (event) => {
    const files = [...(event.dataTransfer?.files || [])].filter((file) => /^image\//i.test(file.type));
    if (!files.length) {
      delete ui.shell.dataset.drop;
      return;
    }

    event.preventDefault();
    delete ui.shell.dataset.drop;
    void insertImagesFromFiles(files);
  });

  document.querySelector("#note-auth-connect")?.addEventListener("click", () => {
    void connectNotes();
  });

  document.querySelector("#note-auth-disconnect")?.addEventListener("click", disconnectNotes);

  document.querySelector("#note-auth-pass")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void connectNotes();
    }
  });

  const savedCollection = activeCollection();
  if (savedCollection) {
    noteState.activeNoteId = savedCollection.noteId;
  }

  updateAllCollections();
  renderActiveEditor();
  refreshAuthStatusFromState();
}

if (isLifePage) {
  bindLifeNotes();
}

if (isLifePage) {
  const user = document.querySelector("#note-auth-user");
  const pass = document.querySelector("#note-auth-pass");

  if (user) {
    user.value = noteState.auth?.username || "berlin2003";
  }
  if (pass) {
    pass.value = noteState.auth?.password || "";
  }
}
