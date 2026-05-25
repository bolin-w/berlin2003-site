const configMap = {
  reading: {
    meta: "论文阅读",
    kicker: "札记一",
    label: "论文阅读",
    title: "论文阅读",
    lead: "收论文精读、结构拆解、方法判断与阅读中的关键批注。",
    figure: "把论文放回问题链条里读。",
    match: ["论文阅读", "论文笔记", "paper", "research", "reading"]
  },
  model: {
    meta: "模型判断",
    kicker: "札记二",
    label: "模型判断",
    title: "模型判断",
    lead: "集中记录架构分工、层级取舍、模块作用与模型间的实际差异。",
    figure: "不是只记模型名，而是记为什么这样判断。",
    match: ["模型判断", "模型训练", "技术总结", "judgement", "judgment", "model", "training"]
  },
  deploy: {
    meta: "部署记录",
    kicker: "札记三",
    label: "部署记录",
    title: "部署记录",
    lead: "收服务器、鉴权、同步、回滚和线上行为排查的全过程。",
    figure: "把线上问题留痕，方便下一次快速回到现场。",
    match: ["部署记录", "deploy", "deployment", "ops"]
  },
  design: {
    meta: "页面改版",
    kicker: "札记四",
    label: "页面改版",
    title: "页面改版",
    lead: "记录导航、布局、内容组织和页面气质上的改动来路。",
    figure: "改版不是换皮，是重新安排信息与阅读顺序。",
    match: ["页面改版", "ui", "页面", "design", "redesign"]
  },
  projects: {
    meta: "项目记录",
    kicker: "项目",
    label: "项目记录",
    title: "项目记录",
    lead: "把项目推进中的文章、阶段沉淀和里程碑单独归档。",
    figure: "项目单独成线，不并进札记序列里。",
    match: ["项目", "项目记录", "项目笔记", "project", "milestone", "roadmap"]
  }
};

const legacyNodes = {
  kicker: document.querySelector("#category-kicker"),
  title: document.querySelector("#category-title"),
  lead: document.querySelector("#category-lead"),
  figureTitle: document.querySelector("#category-figure-title"),
  figureCopy: document.querySelector("#category-figure-copy"),
  label: document.querySelector("#category-label"),
  heading: document.querySelector("#category-heading"),
  footer: document.querySelector("#category-footer"),
  list: document.querySelector("#category-list")
};

const hxNodes = {
  count: document.querySelector("#article-count"),
  list: document.querySelector("#category-articles")
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getMetaCategory() {
  const el = document.querySelector('meta[name="notes-category"]');
  return (el?.content || "").trim();
}

function pickConfig() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key");
  if (key && configMap[key]) {
    return configMap[key];
  }

  const metaCategory = getMetaCategory();
  const matched = Object.values(configMap).find((config) => config.meta === metaCategory || config.title === metaCategory);
  return matched || configMap.reading;
}

function applyLegacyHeader(config) {
  if (!legacyNodes.title) {
    return;
  }
  document.title = `Berlin2003 / ${config.title}`;
  if (legacyNodes.kicker) legacyNodes.kicker.textContent = config.kicker;
  legacyNodes.title.textContent = config.title;
  if (legacyNodes.lead) legacyNodes.lead.textContent = config.lead;
  if (legacyNodes.figureTitle) legacyNodes.figureTitle.textContent = config.title;
  if (legacyNodes.figureCopy) legacyNodes.figureCopy.textContent = config.figure;
  if (legacyNodes.label) legacyNodes.label.textContent = config.label;
  if (legacyNodes.heading) legacyNodes.heading.textContent = `${config.title}文章`;
  if (legacyNodes.footer) legacyNodes.footer.textContent = config.title;
}

function inGroup(article, config) {
  const category = String(article.category || "").toLowerCase();
  return config.match.some((key) => category.includes(key.toLowerCase()));
}

function renderLegacy(items, config) {
  if (!legacyNodes.list) {
    return;
  }

  if (!items.length) {
    legacyNodes.list.innerHTML = `<p style="color:var(--section-muted);margin:0;">这一类还没有公开文章。去 <a href="/studio/notion/" style="color:var(--section-blue);">Notion 导入</a> 里选择「${config.title}」即可归入这里。</p>`;
    return;
  }

  legacyNodes.list.innerHTML = items
    .map((article) => {
      const date = formatDate(article.updatedAt || article.createdAt);
      return `
        <a class="section-lab-card" href="/notes/article/?id=${article.id}" style="text-decoration:none;color:inherit;">
          <span>${article.category || config.title}</span>
          <strong>${article.title}</strong>
          <p>${article.summary || "进入文章详情查看完整内容。"}</p>
          ${date ? `<p style="font-size:0.82rem;color:var(--section-muted);margin-top:10px;">${date}</p>` : ""}
        </a>
      `;
    })
    .join("");
}

function renderHx(items, config) {
  if (!hxNodes.list) {
    return;
  }

  if (hxNodes.count) {
    hxNodes.count.textContent = String(items.length);
  }

  if (!items.length) {
    hxNodes.list.innerHTML = `
      <div class="hx-empty-state">
        <div class="hx-empty-inner">
          <span class="hx-empty-tag">暂无内容</span>
          <h2>这一类还没有公开文章</h2>
          <p>去 <a href="/studio/notion/">Notion 导入</a> 里选择「${config.title}」即可归入这里。</p>
        </div>
      </div>
    `;
    return;
  }

  hxNodes.list.innerHTML = `
    <div class="hx-project-grid">
      ${items
        .map((article, index) => {
          const date = formatDate(article.updatedAt || article.createdAt);
          const code = String(index + 1).padStart(2, "0");
          return `
            <a class="hx-project-card" href="/notes/article/?id=${article.id}">
              <div class="hx-project-card-cover" aria-hidden="true">
                <span class="hx-project-card-code">NOTE ${code}</span>
                <span class="hx-project-card-status">ARCHIVE</span>
                <div class="hx-project-card-lines">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div class="hx-project-card-head">
                <span class="hx-project-card-tag">${article.category || config.title}</span>
                ${date ? `<span class="hx-project-card-date">${date}</span>` : ""}
              </div>
              <strong>${article.title}</strong>
              <p>${article.summary || "进入文章详情查看完整内容。"}</p>
              <div class="hx-project-card-foot">
                <span>阅读笔记</span>
                <span class="hx-project-card-arrow">→</span>
              </div>
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderArticles(articles, config) {
  const items = (articles || []).filter((article) => inGroup(article, config));
  renderLegacy(items, config);
  renderHx(items, config);
}

async function load() {
  const config = pickConfig();
  applyLegacyHeader(config);

  try {
    const res = await fetch("/api/notion/articles?public=true");
    const data = await res.json();
    if (!res.ok) {
      if (legacyNodes.list) {
        legacyNodes.list.innerHTML = '<p style="color:var(--section-muted);margin:0;">文章加载失败。</p>';
      }
      if (hxNodes.list) {
        hxNodes.list.innerHTML = '<div class="hx-empty-state"><div class="hx-empty-inner"><span class="hx-empty-tag">加载异常</span><h2>文章加载失败</h2><p>后端返回了异常结果，请稍后再试。</p></div></div>';
      }
      return;
    }
    renderArticles(data.articles, config);
  } catch {
    if (legacyNodes.list) {
      legacyNodes.list.innerHTML = '<p style="color:var(--section-muted);margin:0;">无法连接文章服务。</p>';
    }
    if (hxNodes.list) {
      hxNodes.list.innerHTML = '<div class="hx-empty-state"><div class="hx-empty-inner"><span class="hx-empty-tag">连接中断</span><h2>无法连接文章服务</h2><p>文章接口暂时没有响应，请稍后刷新。</p></div></div>';
    }
  }
}

load();
