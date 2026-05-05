const AI_STORAGE_KEY = "berlin2003_ai_auth";
const editableSelectors = "main h1, main h2, main h3, main p, main strong, main small";

const state = {
  panelOpen: false,
  auth: loadAuth(),
  editing: false,
  activeElement: null,
  lastOutput: ""
};

function loadAuth() {
  try {
    const raw = sessionStorage.getItem(AI_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { username: "berlin2003", password: "" };
  } catch {
    return { username: "berlin2003", password: "" };
  }
}

function saveAuth(auth) {
  state.auth = auth;
  sessionStorage.setItem(AI_STORAGE_KEY, JSON.stringify(auth));
}

function authHeader() {
  if (!state.auth?.username || !state.auth?.password) {
    return {};
  }
  return {
    Authorization: "Basic " + btoa(`${state.auth.username}:${state.auth.password}`)
  };
}

function buildUI() {
  const toggle = document.createElement("button");
  toggle.className = "site-ai-toggle";
  toggle.type = "button";
  toggle.textContent = "AI";

  const panel = document.createElement("aside");
  panel.className = "site-ai-panel";
  panel.id = "site-ai-panel";
  panel.innerHTML = `
    <div class="site-ai-head">
      <div>
        <strong>页内助手</strong>
        <small>对选中内容、当前块或当前页直接处理</small>
      </div>
      <button class="site-ai-close" type="button">关闭</button>
    </div>

    <div class="site-ai-authbox">
      <div class="site-ai-row">
        <strong>连接</strong>
        <button class="site-ai-auth" type="button">连接</button>
      </div>
      <div class="site-ai-authgrid">
        <div class="site-ai-inline">
          <input id="site-ai-user" placeholder="用户名" value="${state.auth?.username || "berlin2003"}">
          <input id="site-ai-pass" placeholder="密码" type="password" value="${state.auth?.password || ""}">
        </div>
        <div class="site-ai-authline" id="site-ai-authline">先输入私密区账号密码。</div>
      </div>
    </div>

    <div class="site-ai-workbox">
      <div class="site-ai-row">
        <strong>当前上下文</strong>
        <button class="site-ai-save" type="button">保存当前页</button>
      </div>
      <div class="site-ai-help">如果你选中了文字，AI 就处理选中内容；如果没选中，就处理当前块；如果当前块也没选，就处理当前页正文。</div>
      <div class="site-ai-row">
        <button class="site-ai-action" type="button" data-action="edit">开启编辑模式</button>
      </div>
      <div class="site-ai-selection" id="site-ai-selection">未选中任何内容。</div>
      <div class="site-ai-form">
        <textarea id="site-ai-command" placeholder="直接输入你的指令，例如：把这段改得更自然一点，不要太像 AI 写的。"></textarea>
        <textarea id="site-ai-content" placeholder="这里会自动填充当前上下文内容，你也可以手动改。"></textarea>
        <button class="site-ai-run" type="button" id="site-ai-run">执行</button>
      </div>
    </div>

    <div class="site-ai-resultbox">
      <div class="site-ai-result-head">
        <strong>结果</strong>
        <button class="site-ai-copy" type="button">复制</button>
      </div>
      <div class="site-ai-result" id="site-ai-result">结果会显示在这里。</div>
      <div class="site-ai-row">
        <button class="site-ai-apply" type="button" data-apply="replace">替换当前块</button>
        <button class="site-ai-apply" type="button" data-apply="fill">填回输入框</button>
      </div>
      <div class="site-ai-save-note" id="site-ai-save-note">替换后记得点“保存当前页”。</div>
    </div>
  `;

  document.body.append(toggle, panel);
  return { toggle, panel };
}

const ui = buildUI();

function currentEditableElements() {
  return [...document.querySelectorAll(editableSelectors)];
}

function setNote(text) {
  document.querySelector("#site-ai-save-note").textContent = text;
}

function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

function currentScopeLabel() {
  const selected = getSelectedText();
  if (selected) {
    return `当前选中：${selected.slice(0, 180)}`;
  }
  if (state.activeElement) {
    return `当前块：${state.activeElement.innerText.trim().slice(0, 180)}`;
  }
  return "当前页正文";
}

function currentContextText() {
  const selected = getSelectedText();
  if (selected) {
    return selected;
  }
  if (state.activeElement) {
    return state.activeElement.innerText.trim();
  }
  return document.querySelector("main")?.innerText.trim() || "";
}

function refreshSelectionBox() {
  document.querySelector("#site-ai-selection").textContent = currentScopeLabel();
}

function syncContentFromContext() {
  document.querySelector("#site-ai-content").value = currentContextText();
  refreshSelectionBox();
}

function setEditing(enabled) {
  state.editing = enabled;
  currentEditableElements().forEach((el) => {
    el.contentEditable = enabled ? "true" : "false";
    el.spellcheck = enabled;
    el.classList.toggle("editable-highlight", enabled);
  });
  ui.panel.querySelector('[data-action="edit"]').textContent = enabled ? "关闭编辑模式" : "开启编辑模式";
}

function setActiveElement(el) {
  if (state.activeElement) {
    state.activeElement.classList.remove("editable-active");
  }
  state.activeElement = el;
  if (state.activeElement) {
    state.activeElement.classList.add("editable-active");
  }
  syncContentFromContext();
}

function openPanel() {
  state.panelOpen = true;
  ui.panel.classList.add("open");
  syncContentFromContext();
}

function closePanel() {
  state.panelOpen = false;
  ui.panel.classList.remove("open");
}

async function connectAuth() {
  const username = document.querySelector("#site-ai-user").value.trim();
  const password = document.querySelector("#site-ai-pass").value.trim();
  if (!username || !password) {
    document.querySelector("#site-ai-authline").textContent = "先输入用户名和密码。";
    return;
  }
  saveAuth({ username, password });

  const response = await fetch("/api/ai/health", {
    headers: {
      Accept: "application/json",
      ...authHeader()
    }
  });
  if (!response.ok) {
    document.querySelector("#site-ai-authline").textContent = "连接失败，请检查账号密码。";
    return;
  }
  const data = await response.json();
  document.querySelector("#site-ai-authline").textContent = data.configured
    ? `已连接：${data.model}`
    : "已连接，但服务器还没配置上游 Key。";
}

async function runAI() {
  const command = document.querySelector("#site-ai-command").value.trim();
  const content = document.querySelector("#site-ai-content").value.trim();
  if (!content) {
    setNote("先选中内容，或点击一个块。");
    return;
  }

  document.querySelector("#site-ai-result").textContent = "正在执行...";

  const response = await fetch("/api/ai/process", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader()
    },
    body: JSON.stringify({
      mode: "rewrite",
      instruction: `你不要自己选模式，直接严格执行下面这条指令。如果用户的指令不完整，就按“编辑当前网站内容”的方向做最自然的处理。\n用户指令：${command || "请自然地优化当前内容。"}`,
      content: `页面标题：${document.title}\n页面路径：${window.location.pathname}\n作用范围：${currentScopeLabel()}\n\n内容：\n${content}`
    })
  });

  const data = await response.json();
  if (!response.ok) {
    document.querySelector("#site-ai-result").textContent = data.error || "执行失败。";
    setNote("执行失败。");
    return;
  }

  state.lastOutput = data.output || "";
  document.querySelector("#site-ai-result").textContent = state.lastOutput || "没有返回内容。";
  setNote("执行完成。");
}

function applyOutput(mode) {
  if (!state.lastOutput) {
    return;
  }

  if (mode === "fill") {
    document.querySelector("#site-ai-content").value = state.lastOutput;
    return;
  }

  if (mode === "replace" && state.activeElement) {
    state.activeElement.innerText = state.lastOutput;
    syncContentFromContext();
    setNote("已替换当前块，记得保存当前页。");
    return;
  }

  if (mode === "replace" && !state.activeElement) {
    setNote("先开启编辑模式并点击一个当前块，再替换。");
  }
}

function buildSerializableHTML() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelector("#site-ai-panel")?.remove();
  clone.querySelector(".site-ai-toggle")?.remove();
  clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
  clone.querySelectorAll(".editable-highlight").forEach((node) => node.classList.remove("editable-highlight"));
  clone.querySelectorAll(".editable-active").forEach((node) => node.classList.remove("editable-active"));
  return "<!DOCTYPE html>\n" + clone.outerHTML;
}

async function saveCurrentPage() {
  const response = await fetch("/api/editor/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader()
    },
    body: JSON.stringify({
      pagePath: window.location.pathname,
      html: buildSerializableHTML()
    })
  });

  const data = await response.json();
  if (!response.ok) {
    setNote(data.error || "保存失败。");
    return;
  }
  setNote("页面已保存到服务器。");
}

ui.toggle.addEventListener("click", () => {
  state.panelOpen ? closePanel() : openPanel();
});

ui.panel.querySelector(".site-ai-close").addEventListener("click", closePanel);
ui.panel.querySelector(".site-ai-auth").addEventListener("click", connectAuth);
ui.panel.querySelector(".site-ai-save").addEventListener("click", saveCurrentPage);
ui.panel.querySelector("#site-ai-run").addEventListener("click", runAI);
ui.panel.querySelector("#site-ai-command").addEventListener("keydown", async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    await runAI();
  }
});

ui.panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
  setEditing(!state.editing);
  if (state.editing && !state.activeElement) {
    const first = currentEditableElements()[0];
    if (first) {
      setActiveElement(first);
    }
  }
});

ui.panel.querySelector(".site-ai-copy").addEventListener("click", async () => {
  if (!state.lastOutput) return;
  await navigator.clipboard.writeText(state.lastOutput);
  setNote("已复制结果。");
});

ui.panel.querySelectorAll(".site-ai-apply").forEach((button) => {
  button.addEventListener("click", () => applyOutput(button.dataset.apply));
});

document.addEventListener("selectionchange", () => {
  if (state.panelOpen) {
    refreshSelectionBox();
  }
});

currentEditableElements().forEach((el) => {
  el.addEventListener("focus", () => {
    if (state.editing) {
      setActiveElement(el);
    }
  });
  el.addEventListener("click", () => {
    if (state.editing) {
      setActiveElement(el);
    }
  });
});

setEditing(false);
syncContentFromContext();
