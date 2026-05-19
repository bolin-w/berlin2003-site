const statusText = document.querySelector("#anime-admin-status");
const statusDot = document.querySelector("#anime-admin-dot");
const uploadForm = document.querySelector("#video-upload-form");
const listBox = document.querySelector("#video-admin-list");
const refreshButton = document.querySelector("#video-refresh");
const uploadFileInput = uploadForm?.querySelector('input[name="file"]');

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

function durationLabel(seconds) {
  const total = Math.round(Number(seconds || 0));
  if (!Number.isFinite(total) || total <= 0) {
    return "未记录";
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function loadVideoDuration(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const cleanup = () => {
      probe.removeAttribute("src");
      probe.load();
      URL.revokeObjectURL(url);
    };

    probe.preload = "metadata";
    probe.muted = true;
    probe.onloadedmetadata = () => {
      const seconds = Number.isFinite(probe.duration) && probe.duration > 0
        ? Math.round(probe.duration)
        : null;
      cleanup();
      resolve(seconds);
    };
    probe.onerror = () => {
      cleanup();
      resolve(null);
    };
    probe.src = url;
  });
}

function renderList(items) {
  listBox.innerHTML = "";
  if (!items.length) {
    listBox.innerHTML = `<p class="anime-status">暂无入库视频。</p>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "anime-admin-item";
    row.innerHTML = `
      <strong>${item.title}</strong>
      <span>${item.isPublished ? "已发布" : "未发布"} / ${sizeLabel(item.sizeBytes)} / ${durationLabel(item.durationSeconds)}</span>
      <code>${item.mediaUrl}</code>
      <div class="video-admin-actions">
        <a class="copy-button" href="/anime/" target="_blank" rel="noreferrer">去放映室</a>
        ${item.durationSeconds ? "" : `<button class="copy-button" type="button" data-duration="${item.id}">回填时长</button>`}
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

  listBox.querySelectorAll("[data-duration]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.duration;
      setStatus("", "正在读取服务器视频时长...");
      const data = await api(`/api/admin/anime/videos/${id}/duration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      await loadVideos();
      setStatus("ok", `时长已补写：${durationLabel(data.item?.durationSeconds)}。`);
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
  const file = uploadFileInput?.files && uploadFileInput.files[0];
  setStatus("", "正在读取视频时长...");
  const durationSeconds = await loadVideoDuration(file);
  if (durationSeconds) {
    formData.set("durationSeconds", String(durationSeconds));
  }
  setStatus("", "正在上传视频...");
  await api("/api/admin/anime/videos", {
    method: "POST",
    body: formData
  });
  uploadForm.reset();
  await loadVideos();
  setStatus("ok", "视频已入库。");
});

refreshButton.addEventListener("click", () => {
  loadVideos().catch((error) => setStatus("warn", error.message));
});

loadVideos().catch((error) => setStatus("warn", error.message));
