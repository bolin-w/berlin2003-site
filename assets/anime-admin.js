const statusText = document.querySelector("#anime-admin-status");
const statusDot = document.querySelector("#anime-admin-dot");
const uploadForm = document.querySelector("#video-upload-form");
const listBox = document.querySelector("#video-admin-list");
const refreshButton = document.querySelector("#video-refresh");

function setStatus(kind, text) {
  statusDot.className = "status-dot";
  if (kind) {
    statusDot.classList.add(kind);
  }
  statusText.textContent = text;
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(options && options.headers) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败。");
  }
  return data;
}

function sizeLabel(bytes) {
  return `${((bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
}

function renderList(items) {
  listBox.innerHTML = "";
  if (!items.length) {
    listBox.innerHTML = `<p class="anime-status">片库还是空的，先放进第一部。</p>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "anime-admin-item";
    row.innerHTML = `
      <strong>${item.title}</strong>
      <span>${item.isPublished ? "已发布" : "未发布"} / ${sizeLabel(item.sizeBytes)}</span>
      <code>${item.mediaUrl}</code>
      <div class="video-admin-actions">
        <a class="copy-button" href="/anime/" target="_blank" rel="noreferrer">去放映室</a>
        <button class="copy-button" type="button" data-delete="${item.id}">删除</button>
      </div>
    `;
    listBox.appendChild(row);
  });

  listBox.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const ok = confirm("确定把这部片子从片库移走吗？服务器文件也会删除。");
      if (!ok) {
        return;
      }
      await api(`/api/admin/anime/videos/${button.dataset.delete}`, { method: "DELETE" });
      await loadVideos();
    });
  });
}

async function loadVideos() {
  const health = await api("/api/admin/anime/health");
  const data = await api("/api/admin/anime/videos");
  renderList(data.items || []);
  setStatus("ok", `片库在线。单次最多 ${(health.maxUploadBytes / 1024 / 1024 / 1024).toFixed(1)} GB。`);
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  setStatus("", "正在把片子放进片库...");
  await api("/api/admin/anime/videos", {
    method: "POST",
    body: formData
  });
  uploadForm.reset();
  await loadVideos();
  setStatus("ok", "片子已经放进放映室。");
});

refreshButton.addEventListener("click", () => {
  loadVideos().catch((error) => setStatus("warn", error.message));
});

loadVideos().catch((error) => setStatus("warn", error.message));
