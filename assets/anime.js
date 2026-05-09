const statusBox = document.querySelector("#anime-status");
const countBox = document.querySelector("#anime-count");
const listBox = document.querySelector("#video-list");
const detailBox = document.querySelector("#video-detail");

function setStatus(text) {
  statusBox.textContent = text || "";
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
  if (!bytes) {
    return "0 MB";
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function durationLabel(seconds) {
  const total = Math.round(Number(seconds || 0));
  if (!Number.isFinite(total) || total <= 0) {
    return "读取时长...";
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function readMediaDuration(item, card) {
  if (item.durationSeconds) {
    return;
  }
  const summary = card.querySelector(".anime-duration-summary");
  if (!summary) {
    return;
  }
  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.muted = true;
  probe.src = item.mediaUrl;
  probe.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(probe.duration) && probe.duration > 0) {
      item.durationSeconds = probe.duration;
      const label = durationLabel(probe.duration);
      summary.textContent = `时长 ${label}`;
      summary.dataset.ready = "true";
    }
    probe.removeAttribute("src");
    probe.load();
  }, { once: true });
  probe.addEventListener("error", () => {
    summary.textContent = "时长未知";
  }, { once: true });
}

function renderDetail(item) {
  detailBox.innerHTML = `
    <div class="video-player-card">
      <div class="anime-detail-head">
        <div>
          <span>正在播放</span>
          <h2>${item.title}</h2>
          <p>${item.description || "暂无备注。"}</p>
        </div>
      </div>
      <video class="storage-video-player" controls playsinline preload="metadata" ${item.posterUrl ? `poster="${item.posterUrl}"` : ""}>
        <source src="${item.mediaUrl}" type="video/mp4">
      </video>
      <p class="anime-status">时长 ${durationLabel(item.durationSeconds)} / 大小 ${sizeLabel(item.sizeBytes)}</p>
    </div>
  `;
  const player = detailBox.querySelector("video");
  const meta = detailBox.querySelector(".anime-status");
  if (player && meta && !item.durationSeconds) {
    player.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(player.duration) && player.duration > 0) {
        item.durationSeconds = player.duration;
        meta.textContent = `时长 ${durationLabel(player.duration)} / 大小 ${sizeLabel(item.sizeBytes)}`;
      }
    }, { once: true });
  }
}

function renderVideos(items) {
  countBox.textContent = `${items.length} 部片子`;
  listBox.innerHTML = "";

  if (!items.length) {
    listBox.innerHTML = `
      <article class="anime-card anime-card-pending">
        <span>片库为空</span>
        <strong>暂无视频</strong>
        <p>通过片库后台上传已压制字幕的 MP4 后，列表将在这里显示。</p>
      </article>
    `;
    detailBox.innerHTML = `
      <div class="anime-empty">
        <span>播放区</span>
        <p>暂无可播放视频。完成上传后将显示播放器。</p>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "anime-card";
    button.innerHTML = `
      <span>${sizeLabel(item.sizeBytes)}</span>
      <strong>${item.title}</strong>
      <p class="anime-duration-summary">时长 ${durationLabel(item.durationSeconds)}</p>
      <small>${new Date(item.updatedAt).toLocaleString()}</small>
    `;
    button.addEventListener("click", () => renderDetail(item));
    listBox.appendChild(button);
    readMediaDuration(item, button);
  });

  renderDetail(items[0]);
}

async function loadVideos() {
  setStatus("正在读取片库...");
  const data = await api("/api/anime/videos");
  renderVideos(data.items || []);
  setStatus("片库已更新。");
}

loadVideos().catch((error) => {
  setStatus(error.message);
});
