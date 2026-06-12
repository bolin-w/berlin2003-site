(() => {
  const statusBox = document.querySelector("#anime-status");
  const countBox = document.querySelector("#anime-count");
  const railsBox = document.querySelector("#cinema-rails");
  const heroInner = document.querySelector("#cinema-hero-inner");
  const heroBg = document.querySelector("#cinema-hero-bg");
  const searchInput = document.querySelector("#anime-search");
  const sortSelect = document.querySelector("#anime-sort");

  const RESUME_KEY = "berlin2003.anime.resume";
  const PREFS_KEY = "berlin2003.anime.prefs";

  const state = {
    all: [],
    filtered: [],
    currentIdx: -1,
    query: "",
    sort: "new",
    autoplayNext: true,
    speed: 1,
    playing: false,
  };

  loadPrefs();

  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      if (p.sort) state.sort = p.sort;
      if (typeof p.autoplayNext === "boolean") state.autoplayNext = p.autoplayNext;
      if (p.speed) state.speed = p.speed;
    } catch (e) {}
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        sort: state.sort, autoplayNext: state.autoplayNext, speed: state.speed,
      }));
    } catch (e) {}
  }

  function getResumeMap() {
    try { return JSON.parse(localStorage.getItem(RESUME_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveResume(id, t, dur) {
    const m = getResumeMap();
    if (!t || t < 5 || (dur && t > dur - 10)) delete m[id];
    else m[id] = { t, dur, at: Date.now() };
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function getResume(id) {
    const m = getResumeMap();
    return m[id] && m[id].t ? m[id] : null;
  }

  function setStatus(t) { if (statusBox) statusBox.textContent = t || ""; }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function videoId(item) {
    return item.id || item.slug || item.mediaUrl || item.title;
  }
  function sizeLabel(b) {
    if (!b) return "—";
    if (b > 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
    return `${(b / 1024 / 1024).toFixed(0)} MB`;
  }
  function dateLabel(s) {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  function timeLabel(sec) {
    if (!sec || !isFinite(sec)) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  async function api(path) {
    const r = await fetch(path, { headers: { Accept: "application/json" } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "请求失败。");
    return d;
  }

  function applyFilterSort() {
    const q = state.query.trim().toLowerCase();
    let list = state.all.slice();
    if (q) {
      list = list.filter((it) =>
        (it.title || "").toLowerCase().includes(q) ||
        (it.description || "").toLowerCase().includes(q)
      );
    }
    const sorters = {
      new: (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
      old: (a, b) => new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0),
      title: (a, b) => (a.title || "").localeCompare(b.title || "", "zh"),
      size: (a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0),
    };
    list.sort(sorters[state.sort] || sorters.new);
    state.filtered = list;
  }

  function buildCard(item) {
    const id = videoId(item);
    const resume = getResume(id);
    const pct = resume && resume.dur ? Math.min(100, (resume.t / resume.dur) * 100) : 0;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "hx-cinema-card";
    card.dataset.id = id;
    card.innerHTML = `
      <div class="hx-cinema-card-thumb">
        ${item.posterUrl
          ? `<img src="${escapeHTML(item.posterUrl)}" alt="" loading="lazy">`
          : `<div class="hx-cinema-card-fallback"><span>▶</span></div>`}
        <div class="hx-cinema-card-overlay">
          <div class="hx-cinema-card-play">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          </div>
          <div class="hx-cinema-card-info">
            <p class="hx-cinema-card-title">${escapeHTML(item.title)}</p>
            <div class="hx-cinema-card-meta">
              <span>${sizeLabel(item.sizeBytes)}</span>
              <span>${dateLabel(item.updatedAt)}</span>
            </div>
          </div>
        </div>
        ${pct > 0 ? `<div class="hx-cinema-card-progress"><div style="width:${pct.toFixed(1)}%"></div></div>` : ""}
        ${resume ? `<span class="hx-cinema-card-badge">续看</span>` : ""}
      </div>
      <p class="hx-cinema-card-name">${escapeHTML(item.title)}</p>`;
    card.addEventListener("click", () => playById(id));
    return card;
  }

  function buildRail(title, items, opts = {}) {
    if (!items.length) return null;
    const rail = document.createElement("section");
    rail.className = "hx-cinema-rail" + (opts.big ? " is-big" : "");
    rail.innerHTML = `
      <header class="hx-cinema-rail-head">
        <h2>${escapeHTML(title)}</h2>
        <span class="hx-cinema-rail-count">${items.length}</span>
        <div class="hx-cinema-rail-nav">
          <button type="button" class="hx-cinema-rail-btn" data-dir="-1" aria-label="向左">‹</button>
          <button type="button" class="hx-cinema-rail-btn" data-dir="1" aria-label="向右">›</button>
        </div>
      </header>
      <div class="hx-cinema-rail-track"></div>`;
    const track = rail.querySelector(".hx-cinema-rail-track");
    items.forEach((it) => track.appendChild(buildCard(it)));
    rail.querySelectorAll(".hx-cinema-rail-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const dir = parseInt(b.dataset.dir, 10);
        track.scrollBy({ left: dir * (track.clientWidth * 0.8), behavior: "smooth" });
      });
    });
    return rail;
  }

  function renderRails() {
    if (countBox) countBox.textContent = state.all.length;
    railsBox.innerHTML = "";

    if (!state.filtered.length) {
      railsBox.innerHTML = `<div class="hx-cinema-empty">${state.all.length ? "没有匹配项" : "还没有视频"}</div>`;
      return;
    }

    if (state.query.trim()) {
      const r = buildRail(`搜索结果 · "${state.query}"`, state.filtered);
      if (r) railsBox.appendChild(r);
      return;
    }

    const resumeMap = getResumeMap();
    const resumeItems = state.filtered.filter((it) => resumeMap[videoId(it)]);
    resumeItems.sort((a, b) => (resumeMap[videoId(b)].at || 0) - (resumeMap[videoId(a)].at || 0));
    const resumeRail = buildRail("继续观看", resumeItems);
    if (resumeRail) railsBox.appendChild(resumeRail);

    const latest = state.filtered.slice().sort((a, b) =>
      new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    ).slice(0, 12);
    const latestRail = buildRail("最近添加", latest, { big: true });
    if (latestRail) railsBox.appendChild(latestRail);

    const allRail = buildRail("全部影片", state.filtered);
    if (allRail) railsBox.appendChild(allRail);

    highlightActive();
  }

  function highlightActive() {
    if (state.currentIdx < 0) return;
    const id = videoId(state.filtered[state.currentIdx]);
    document.querySelectorAll(".hx-cinema-card").forEach((c) => {
      c.classList.toggle("is-active", c.dataset.id === id);
    });
  }

  function playById(id) {
    const idx = state.filtered.findIndex((it) => videoId(it) === id);
    if (idx >= 0) playIndex(idx);
  }

  function playIndex(idx) {
    if (idx < 0 || idx >= state.filtered.length) return;
    state.currentIdx = idx;
    state.playing = true;
    renderHero(state.filtered[idx]);
    highlightActive();
    document.querySelector(".hx-cinema-hero").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderHero(item) {
    const id = videoId(item);
    const resume = getResume(id);
    const speedOpts = [0.5, 0.75, 1, 1.25, 1.5, 2];

    if (heroBg) {
      heroBg.style.backgroundImage = item.posterUrl ? `url("${item.posterUrl}")` : "none";
    }

    heroInner.innerHTML = `
      <div class="hx-cinema-theatre">
        <div class="hx-cinema-video-wrap">
          <video class="hx-cinema-video" id="hx-video" controls playsinline preload="metadata"
                 ${item.posterUrl ? `poster="${escapeHTML(item.posterUrl)}"` : ""}>
            <source src="${escapeHTML(item.mediaUrl)}" type="video/mp4">
          </video>
        </div>

        <div class="hx-cinema-info">
          <div class="hx-cinema-info-head">
            <span class="hx-cinema-now">● NOW PLAYING</span>
            <span class="hx-cinema-index">${state.currentIdx + 1} / ${state.filtered.length}</span>
          </div>
          <h2 class="hx-cinema-info-title">${escapeHTML(item.title)}</h2>
          ${item.description ? `<p class="hx-cinema-info-desc">${escapeHTML(item.description)}</p>` : ""}
          <div class="hx-cinema-info-meta">
            <span>📦 ${sizeLabel(item.sizeBytes)}</span>
            <span>📅 ${dateLabel(item.updatedAt)}</span>
            <span id="hx-duration">⏱ —</span>
          </div>

          <div class="hx-player-toolbar">
            <button type="button" class="hx-pbtn" id="btn-prev" title="上一个 (P)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              <span>上一个</span>
            </button>
            <button type="button" class="hx-pbtn hx-pbtn-primary" id="btn-play">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
              <span>播放</span>
            </button>
            <button type="button" class="hx-pbtn" id="btn-next" title="下一个 (N)">
              <span>下一个</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            </button>
            <label class="hx-pswitch" title="自动连播">
              <input type="checkbox" id="autoplay-next" ${state.autoplayNext ? "checked" : ""}>
              <span>连播</span>
            </label>
            <label class="hx-pselect" title="速度">
              <span>速度</span>
              <select id="speed-select">
                ${speedOpts.map((s) => `<option value="${s}" ${s === state.speed ? "selected" : ""}>${s}x</option>`).join("")}
              </select>
            </label>
            <button type="button" class="hx-pbtn" id="btn-pip" title="画中画">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="6"/></svg>
              <span>PiP</span>
            </button>
            <button type="button" class="hx-pbtn" id="btn-fullscreen" title="全屏 (F)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            </button>
          </div>
          <div class="hx-cinema-hotkeys">
            <span>Space 播放/暂停</span><span>← →  ±5s</span><span>↑ ↓ 音量</span><span>F 全屏</span><span>N/P 切换</span><span>M 静音</span>
          </div>
        </div>
      </div>`;

    const video = document.getElementById("hx-video");
    video.playbackRate = state.speed;
    video.play().catch(() => {});

    video.addEventListener("loadedmetadata", () => {
      const dur = document.getElementById("hx-duration");
      if (dur) dur.textContent = `⏱ ${timeLabel(video.duration)}`;
      if (resume && resume.t > 5 && resume.t < video.duration - 10) {
        video.currentTime = resume.t;
      }
    });

    let lastSave = 0;
    video.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - lastSave > 4000) {
        lastSave = now;
        saveResume(id, video.currentTime, video.duration);
      }
    });
    video.addEventListener("pause", () => saveResume(id, video.currentTime, video.duration));
    video.addEventListener("ended", () => {
      saveResume(id, 0, video.duration);
      if (state.autoplayNext && state.currentIdx < state.filtered.length - 1) {
        playIndex(state.currentIdx + 1);
      }
    });
    video.addEventListener("play", () => {
      const btn = document.getElementById("btn-play");
      if (btn) btn.querySelector("span").textContent = "暂停";
    });
    video.addEventListener("pause", () => {
      const btn = document.getElementById("btn-play");
      if (btn) btn.querySelector("span").textContent = "播放";
    });

    document.getElementById("btn-play").addEventListener("click", () => {
      video.paused ? video.play() : video.pause();
    });
    document.getElementById("btn-prev").addEventListener("click", () => {
      if (state.currentIdx > 0) playIndex(state.currentIdx - 1);
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      if (state.currentIdx < state.filtered.length - 1) playIndex(state.currentIdx + 1);
    });
    document.getElementById("autoplay-next").addEventListener("change", (e) => {
      state.autoplayNext = e.target.checked; savePrefs();
    });
    document.getElementById("speed-select").addEventListener("change", (e) => {
      state.speed = parseFloat(e.target.value);
      video.playbackRate = state.speed;
      savePrefs();
    });
    document.getElementById("btn-pip").addEventListener("click", async () => {
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else if (video.requestPictureInPicture) await video.requestPictureInPicture();
      } catch (e) {}
    });
    document.getElementById("btn-fullscreen").addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else video.requestFullscreen && video.requestFullscreen();
    });
  }

  function setupKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""))) return;
      const v = document.getElementById("hx-video");
      if (!v) return;
      switch (e.key) {
        case " ": e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case "ArrowRight": v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); break;
        case "ArrowLeft": v.currentTime = Math.max(0, v.currentTime - 5); break;
        case "ArrowUp": e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break;
        case "ArrowDown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break;
        case "f": case "F":
          if (document.fullscreenElement) document.exitFullscreen();
          else v.requestFullscreen && v.requestFullscreen();
          break;
        case "n": case "N":
          if (state.currentIdx < state.filtered.length - 1) playIndex(state.currentIdx + 1);
          break;
        case "p": case "P":
          if (state.currentIdx > 0) playIndex(state.currentIdx - 1);
          break;
        case "m": case "M": v.muted = !v.muted; break;
      }
      if (e.target.tagName === "BUTTON") e.target.blur();
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === " " && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""))) {
        e.preventDefault();
      }
    });
  }

  function setupControls() {
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.query = e.target.value;
        applyFilterSort();
        renderRails();
      });
    }
    if (sortSelect) {
      sortSelect.value = state.sort;
      sortSelect.addEventListener("change", (e) => {
        state.sort = e.target.value; savePrefs();
        applyFilterSort();
        renderRails();
      });
    }
  }

  async function load() {
    setStatus("Loading...");
    try {
      const data = await api("/api/anime/videos");
      state.all = data.items || [];
      applyFilterSort();
      renderRails();
      setStatus(state.all.length ? `${state.all.length} videos` : "暂无视频");
    } catch (err) {
      setStatus(err.message || "加载失败");
      railsBox.innerHTML = `<div class="hx-cinema-empty">加载失败: ${escapeHTML(err.message || "")}</div>`;
    }
  }

  setupControls();
  setupKeyboard();
  load();
})();
