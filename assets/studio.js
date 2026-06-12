const presets = {
  homepage: "把下面内容改写成网站首页可直接使用的文案。要求：中文、克制、不要 AI 腔、不要空话、尽量短。",
  module: "把下面内容整理成适合网站模块页的结构。输出：标题、简短引言、3个小模块，每个模块 1 句话。",
  notes: "把下面内容整理成工作笔记。要求：更像真实记录，不要营销感，不要大而空。",
  refine: "把下面内容润色得更自然、更简洁，保留原意，不要夸张。"
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
      setStatus("ok", `已连接，默认模型：${data.model}`);
      return;
    }
    setStatus("warn", "工作台已上线，但服务器还没配置 OpenAI API Key。");
  } catch (error) {
    setStatus("warn", "无法连接到内容工作台后端。");
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
  if (!text || text === "输出会显示在这里。") {
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
    setStatus("warn", "先输入要处理的内容。");
    return;
  }

  resultBox.textContent = "正在生成...";
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
      resultBox.textContent = data.error || "请求失败。";
      setStatus("warn", "生成失败。");
      return;
    }

    resultBox.textContent = data.output || "没有返回内容。";
    setStatus("ok", `已完成，模型：${data.model}`);
  } catch (error) {
    resultBox.textContent = "请求失败，请检查网络或后端服务。";
    setStatus("warn", "无法调用工作台。");
  }
});

checkHealth();
