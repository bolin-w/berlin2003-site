const SITE_CHAT_SUGGESTIONS = [
  "你主要在研究什么？",
  "现在公开了哪些项目？",
  "怎么联系你？"
];

const siteChatState = {
  open: false,
  pending: false,
  history: [
    {
      role: "assistant",
      content: "可以直接问我研究方向、公开项目、笔记更新，或者怎么联系站点主人。"
    }
  ]
};

function createSiteChat() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-chat-button";
  button.textContent = "问我";

  const panel = document.createElement("aside");
  panel.className = "site-chat-panel";
  panel.innerHTML = `
    <div class="site-chat-head">
      <div>
        <strong>站内问答</strong>
        <small>只回答本站公开内容，不涉及私密生活区。</small>
      </div>
      <button class="site-chat-close" type="button">收起</button>
    </div>
    <div class="site-chat-body">
      <div class="site-chat-suggestions"></div>
      <div class="site-chat-log" id="site-chat-log" aria-live="polite"></div>
      <div class="site-chat-status" id="site-chat-status"></div>
      <form class="site-chat-form" id="site-chat-form">
        <textarea
          id="site-chat-input"
          class="site-chat-input"
          placeholder="例如：你在做什么研究？"
        ></textarea>
        <div class="site-chat-formfoot">
          <small>Enter 发送，Shift + Enter 换行</small>
          <button class="site-chat-send" id="site-chat-send" type="submit">发送</button>
        </div>
      </form>
    </div>
  `;

  document.body.append(button, panel);
  return { button, panel };
}

const siteChatUI = createSiteChat();

function renderSuggestions() {
  const wrapper = siteChatUI.panel.querySelector(".site-chat-suggestions");
  wrapper.innerHTML = "";

  SITE_CHAT_SUGGESTIONS.forEach((text) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "site-chat-chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      siteChatUI.panel.querySelector("#site-chat-input").value = text;
      void submitSiteChat(text);
    });
    wrapper.appendChild(chip);
  });
}

function renderMessages() {
  const log = siteChatUI.panel.querySelector("#site-chat-log");
  log.innerHTML = "";

  if (!siteChatState.history.length) {
    const empty = document.createElement("div");
    empty.className = "site-chat-empty";
    empty.textContent = "还没有对话。";
    log.appendChild(empty);
    return;
  }

  siteChatState.history.forEach((message) => {
    const item = document.createElement("div");
    item.className = `site-chat-message ${message.role}`;
    item.textContent = message.content;
    log.appendChild(item);
  });

  if (siteChatState.pending) {
    const pending = document.createElement("div");
    pending.className = "site-chat-message assistant";
    pending.textContent = "正在整理公开信息...";
    log.appendChild(pending);
  }

  log.scrollTop = log.scrollHeight;
}

function setSiteChatStatus(text) {
  siteChatUI.panel.querySelector("#site-chat-status").textContent = text || "";
}

function setSiteChatOpen(open) {
  siteChatState.open = open;
  siteChatUI.panel.classList.toggle("open", open);
  if (open) {
    siteChatUI.panel.querySelector("#site-chat-input").focus();
  }
}

async function submitSiteChat(rawText) {
  const input = siteChatUI.panel.querySelector("#site-chat-input");
  const sendButton = siteChatUI.panel.querySelector("#site-chat-send");
  const text = String(rawText || input.value || "").trim();

  if (!text || siteChatState.pending) {
    return;
  }

  const historyForApi = siteChatState.history.slice(-6);
  siteChatState.history.push({ role: "user", content: text });
  siteChatState.pending = true;
  input.value = "";
  input.disabled = true;
  sendButton.disabled = true;
  setSiteChatStatus("处理中...");
  renderMessages();

  try {
    const response = await fetch("/api/public/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        message: text,
        history: historyForApi,
        page: {
          title: document.title,
          path: window.location.pathname
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      siteChatState.history.push({
        role: "assistant",
        content: data.error || "暂时无法回答，请稍后再试。"
      });
      setSiteChatStatus(response.status === 429 ? "请求过于频繁，请稍后再试。" : "请求失败。");
      return;
    }

    siteChatState.history.push({
      role: "assistant",
      content: data.output || "暂时没有可返回的内容。"
    });
    setSiteChatStatus("");
  } catch (_error) {
    siteChatState.history.push({
      role: "assistant",
      content: "连接失败了，请稍后再试。"
    });
    setSiteChatStatus("网络连接失败。");
  } finally {
    siteChatState.pending = false;
    input.disabled = false;
    sendButton.disabled = false;
    renderMessages();
    input.focus();
  }
}

siteChatUI.button.addEventListener("click", () => {
  setSiteChatOpen(!siteChatState.open);
});

siteChatUI.panel.querySelector(".site-chat-close").addEventListener("click", () => {
  setSiteChatOpen(false);
});

siteChatUI.panel.querySelector("#site-chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitSiteChat();
});

siteChatUI.panel.querySelector("#site-chat-input").addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await submitSiteChat();
  }
});

renderSuggestions();
renderMessages();
