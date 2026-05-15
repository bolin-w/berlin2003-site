const configMap = {
  reading: {
    kicker: "札记一",
    label: "论文阅读",
    title: "论文阅读",
    lead: "收论文精读、结构拆解、方法判断与阅读中的关键批注。",
    figure: "把论文放回问题链条里读。",
    match: ["论文阅读", "论文笔记", "paper", "research", "reading"]
  },
  model: {
    kicker: "札记二",
    label: "模型判断",
    title: "模型判断",
    lead: "集中记录架构分工、层级取舍、模块作用与模型间的实际差异。",
    figure: "不是只记模型名，而是记为什么这样判断。",
    match: ["模型判断", "技术总结", "judgement", "judgment", "model"]
  },
  deploy: {
    kicker: "札记三",
    label: "部署记录",
    title: "部署记录",
    lead: "收服务器、鉴权、同步、回滚和线上行为排查的全过程。",
    figure: "把线上问题留痕，方便下一次快速回到现场。",
    match: ["部署记录", "deploy", "deployment", "ops"]
  },
  design: {
    kicker: "札记四",
    label: "页面改版",
    title: "页面改版",
    lead: "记录导航、布局、内容组织和页面气质上的改动来路。",
    figure: "改版不是换皮，是重新安排信息与阅读顺序。",
    match: ["页面改版", "ui", "页面", "design"]
  },
  projects: {
    kicker: "项目",
    label: "项目记录",
    title: "项目记录",
    lead: "把项目推进中的文章、阶段沉淀和里程碑单独归档。",
    figure: "项目单独成线，不并进札记序列里。",
    match: ["项目", "项目记录", "项目笔记", "project", "milestone", "roadmap"]
  }
};

const kickerEl = document.querySelector("#category-kicker");
const titleEl = document.querySelector("#category-title");
const leadEl = document.querySelector("#category-lead");
const figureTitleEl = document.querySelector("#category-figure-title");
const figureCopyEl = document.querySelector("#category-figure-copy");
const labelEl = document.querySelector("#category-label");
const headingEl = document.querySelector("#category-heading");
const footerEl = document.querySelector("#category-footer");
const listEl = document.querySelector("#category-list");

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function pickConfig() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key");
  return configMap[key] || configMap.reading;
}

function applyHeader(config) {
  document.title = `Berlin2003 / ${config.title}`;
  kickerEl.textContent = config.kicker;
  titleEl.textContent = config.title;
  leadEl.textContent = config.lead;
  figureTitleEl.textContent = config.title;
  figureCopyEl.textContent = config.figure;
  labelEl.textContent = config.label;
  headingEl.textContent = `${config.title}文章`;
  footerEl.textContent = config.title;
}

function inGroup(article, config) {
  const category = String(article.category || "").toLowerCase();
  return config.match.some((key) => category.includes(key.toLowerCase()));
}

function renderArticles(articles, config) {
  const items = (articles || []).filter((article) => inGroup(article, config));
  if (!items.length) {
    listEl.innerHTML = `<p style="color:var(--section-muted);margin:0;">这一类还没有公开文章。去 <a href="/studio/notion/" style="color:var(--section-blue);">Notion 导入</a> 里选择「${config.title}」即可归入这里。</p>`;
    return;
  }

  listEl.innerHTML = items
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

async function load() {
  const config = pickConfig();
  applyHeader(config);

  try {
    const res = await fetch("/api/notion/articles?public=true");
    const data = await res.json();
    if (!res.ok) {
      listEl.innerHTML = '<p style="color:var(--section-muted);margin:0;">文章加载失败。</p>';
      return;
    }
    renderArticles(data.articles, config);
  } catch {
    listEl.innerHTML = '<p style="color:var(--section-muted);margin:0;">无法连接文章服务。</p>';
  }
}

load();
