const container = document.querySelector("#project-notion-articles");

const projectMap = [
  {
    id: "project-speech-coding",
    label: "方向一",
    title: "语音编码",
    accent: "blue",
    status: "推进中",
    statusKind: "is-active",
    desc: "把语音编码算法和模型做部署转化，从研究原型走向可运行的工程实现。",
    match: ["语音编码", "speech coding", "codec", "编码", "部署转化", "algorithm"]
  },
  {
    id: "project-speech-subtitle",
    label: "方向二",
    title: "语音字幕识别",
    accent: "teal",
    status: "推进中",
    statusKind: "is-active",
    desc: "用语音识别模型识别视频语音并自动生成字幕，让每一段视频都可被阅读。",
    match: ["语音字幕", "语音识别", "speech subtitle", "asr", "字幕", "subtitle", "recognition"]
  },
  {
    id: "project-website-design",
    label: "方向三",
    title: "网站设计",
    accent: "coral",
    status: "推进中",
    statusKind: "is-active",
    desc: "从页面结构到部署链路，记录这个网站具体怎么做出来的每一步。",
    match: ["网站设计", "website design", "web", "前端", "caddy", "站点", "部署", "design", "notion"]
  }
];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderArticles(articles) {
  if (!container) return;

  const all = articles || [];
  const groups = projectMap.map((p) => ({ ...p, items: [] }));
  const unmatched = [];

  for (const article of all) {
    const cat = String(article.category || "").toLowerCase();
    const target = groups.find((g) => g.match.some((key) => cat.includes(key.toLowerCase())));
    if (target) {
      target.items.push(article);
    } else {
      unmatched.push(article);
    }
  }

  let html = "";

  for (const group of groups) {
    const articleCards = group.items
      .map((article) => {
        const date = formatDate(article.createdAt);
        return `
          <a class="section-lab-card" href="/notes/article/?id=${article.id}" style="text-decoration:none;color:inherit;">
            <span>${article.category || "项目记录"}</span>
            <strong>${article.title}</strong>
            ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:10px;">${date}</p>` : ""}
          </a>
        `;
      })
      .join("");

    html += `
      <section id="${group.id}" class="section-lab-panel project-panel-accent-${group.accent}">
        <p class="section-lab-label">${group.label}</p>
        <h2>${group.title}</h2>
        <p>${group.desc}</p>
        <div class="project-panel-meta">
          <span class="project-card-status ${group.statusKind}">${group.status}</span>
          <span class="project-panel-count">${group.items.length} 篇记录</span>
        </div>
        ${group.items.length ? `<div class="section-lab-grid two" style="margin-top:18px;">${articleCards}</div>` : `<p style="margin-top:16px;color:var(--section-muted);font-size:0.92rem;">暂无导入文章，在 <a href="/studio/notion/" style="color:var(--section-blue);">Notion 导入</a> 时选择「${group.title}」分类即可归入此处。</p>`}
      </section>
    `;
  }

  if (unmatched.length) {
    html += `
      <section class="section-lab-panel">
        <p class="section-lab-label">其他</p>
        <h2>未归入方向的记录</h2>
        <div class="section-lab-grid two" style="margin-top:18px;">
          ${unmatched
            .map((article) => {
              const date = formatDate(article.createdAt);
              return `
                <a class="section-lab-card" href="/notes/article/?id=${article.id}" style="text-decoration:none;color:inherit;">
                  <span>${article.category || "记录"}</span>
                  <strong>${article.title}</strong>
                  ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:10px;">${date}</p>` : ""}
                </a>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  container.innerHTML = html;

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
}

async function load() {
  try {
    const res = await fetch("/api/notion/articles?public=true");
    const data = await res.json();
    renderArticles(res.ok ? data.articles : []);
  } catch {
    renderArticles([]);
  }
}

window.addEventListener("hashchange", () => {
  if (!window.location.hash) return;
  const target = document.querySelector(window.location.hash);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

load();
