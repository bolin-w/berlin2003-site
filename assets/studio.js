const presets = {
  homepage: "把下面内容改写成网站首页可以直接使用的片段。中文、克制、像真实个人站，不要空话。",
  module: "把下面内容整理成页面模块。输出：标题、简短引言、3 个小模块，每个模块 1 句话。",
  notes: "把下面内容整理成工作笔记。像真实记录，不要营销感，不要大而空。",
  refine: "把下面内容顺一遍，让它更自然、更短，保留原意，不要夸张。"
};

const form = document.querySelector("#studio-form");
const presetButtons = document.querySelectorAll("[data-preset]");
const instructionInput = document.querySelector("#instruction");
const contentInput = document.querySelector("#content");
const modeInput = document.querySelector("#mode");
const resultBox = document.querySelector("#result");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");
const copyButton = document.querySelector("#copy-output");

function setStatus(kind, text) {
  statusDot.className = "status-dot";
  if (kind) {
    statusDot.classList.add(kind);
  }
  statusText.textContent = text;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/ai/health", {
      headers: { Accept: "application/json" }
    });
    const data = await response.json();
    if (response.ok && data.configured) {
      setStatus("ok", `工作台醒着，默认模型：${data.model}`);
      return;
    }
    setStatus("warn", "工作台在，但模型钥匙还没放好。");
  } catch (error) {
    setStatus("warn", "后端连接失败。");
  }
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const preset = button.dataset.preset;
    instructionInput.value = presets[preset] || "";
  });
});

copyButton.addEventListener("click", async () => {
  const text = resultBox.textContent.trim();
  if (!text || text === "处理结果将在这里显示。") {
    return;
  }
  await navigator.clipboard.writeText(text);
  copyButton.textContent = "已复制";
  setTimeout(() => {
    copyButton.textContent = "复制结果";
  }, 1500);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = contentInput.value.trim();
  const instruction = instructionInput.value.trim();
  const mode = modeInput.value;

  if (!content) {
    setStatus("warn", "请输入原始文本。");
    return;
  }

  resultBox.textContent = "正在处理文本...";
  setStatus("", "处理中...");

  try {
    const response = await fetch("/api/ai/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        mode,
        instruction,
        content
      })
    });

    const data = await response.json();

    if (!response.ok) {
      resultBox.textContent = data.error || "处理失败。";
      setStatus("warn", "处理失败。");
      return;
    }

    resultBox.textContent = data.output || "没有生成可用内容。";
    setStatus("ok", `处理完成，模型：${data.model}`);
  } catch (error) {
    resultBox.textContent = "后端连接失败，请稍后重试。";
    setStatus("warn", "后端连接失败。");
  }
});

checkHealth();
