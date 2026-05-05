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

function renderDetail(item) {
  detailBox.innerHTML = `
    <div class="video-player-card">
      <div class="anime-detail-head">
        <div>
          <span>Now Playing</span>
          <h2>${item.title}</h2>
          <p>${item.description || "这部片子还没有写备注。"}</p>
        </div>
      </div>
      <video class="storage-video-player" controls playsinline preload="metadata" ${item.posterUrl ? `poster="${item.posterUrl}"` : ""}>
        <source src="${item.mediaUrl}" type="video/mp4">
      </video>
      <p class="anime-status">片源大小 ${sizeLabel(item.sizeBytes)}</p>
    </div>
  `;
}

function renderVideos(items) {
  countBox.textContent = `${items.length} items`;
  listBox.innerHTML = "";

  if (!items.length) {
    listBox.innerHTML = `
      <article class="anime-card anime-card-pending">
        <span>Empty</span>
        <strong>片库还空着</strong>
        <p>去后台放进第一部压好字幕的 MP4，片单就会亮起来。</p>
      </article>
    `;
    detailBox.innerHTML = `
      <div class="anime-empty">
        <span>Storage</span>
        <p>还没有片源。等第一部片子入库后，这里会变成播放屏。</p>
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
      <p>${item.description || "还没有备注，点开直接看。"}</p>
      <small>${new Date(item.updatedAt).toLocaleString()}</small>
    `;
    button.addEventListener("click", () => renderDetail(item));
    listBox.appendChild(button);
  });

  renderDetail(items[0]);
}

async function loadVideos() {
  setStatus("正在整理片单...");
  const data = await api("/api/anime/videos");
  renderVideos(data.items || []);
  setStatus("片单已经摆好。");
}

loadVideos().catch((error) => {
  setStatus(error.message);
});
