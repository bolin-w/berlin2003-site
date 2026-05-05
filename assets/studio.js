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
    setStatus("warn", "暂时叫不醒工作台后端。");
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
  if (!text || text === "整理后的文字会留在这里。") {
    return;
  }
  await navigator.clipboard.writeText(text);
  copyButton.textContent = "已拿走";
  setTimeout(() => {
    copyButton.textContent = "复制这段";
  }, 1500);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = contentInput.value.trim();
  const instruction = instructionInput.value.trim();
  const mode = modeInput.value;

  if (!content) {
    setStatus("warn", "先放一段文字进来。");
    return;
  }

  resultBox.textContent = "正在整理这段文字...";
  setStatus("", "正在慢慢整理...");

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
      resultBox.textContent = data.error || "这次没有整理出来。";
      setStatus("warn", "这次没整理好。");
      return;
    }

    resultBox.textContent = data.output || "没有留下可用内容。";
    setStatus("ok", `已经整理好，模型：${data.model}`);
  } catch (error) {
    resultBox.textContent = "这次没有连上后端，稍后再试。";
    setStatus("warn", "工作台暂时没回应。");
  }
});

checkHealth();
