const importForm = document.querySelector("#notion-import-form");
const urlInput = document.querySelector("#notion-url");
const categoryInput = document.querySelector("#notion-category");
const publicInput = document.querySelector("#notion-public");
const importBtn = document.querySelector("#import-btn");
const statusDot = document.querySelector("#import-status-dot");
const statusText = document.querySelector("#import-status-text");
const articlesList = document.querySelector("#articles-list");
const refreshBtn = document.querySelector("#refresh-articles");

function setStatus(kind, text) {
  statusDot.className = "status-dot";
  if (kind) {
    statusDot.classList.add(kind);
  }
  statusText.textContent = text;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/ai/health");
    const data = await response.json();
    if (response.ok && data.notionConfigured) {
      setStatus("ok", "Notion API 已配置，可以开始导入。");
      return;
    }
    setStatus("warn", "后端已上线，但还没配置 NOTION_API_KEY。");
  } catch {
    setStatus("warn", "无法连接后端服务。");
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function renderArticles(articles) {
  if (!articles || articles.length === 0) {
    articlesList.innerHTML = '<p class="result-placeholder">还没有导入任何文章。</p>';
    return;
  }

  const categoryGroups = [
    { title: "论文阅读", match: ["论文阅读", "论文笔记", "paper", "research", "reading"] },
    { title: "模型判断", match: ["模型判断", "技术总结", "judgement", "judgment", "model"] },
    { title: "部署记录", match: ["部署记录", "deploy", "deployment", "ops"] },
    { title: "页面改版", match: ["页面改版", "ui", "页面", "design"] },
    { title: "项目记录", match: ["项目", "项目记录", "项目笔记", "project", "milestone", "roadmap"] },
    { title: "其余文章", match: [] }
  ];

  const grouped = categoryGroups.map((group) => ({ ...group, items: [] }));
  for (const article of articles) {
    const category = String(article.category || "").toLowerCase();
    const target =
      grouped.find((group) => group.match.some((key) => category.includes(key.toLowerCase()))) ||
      grouped[grouped.length - 1];
    target.items.push(article);
  }

  let html = "";
  for (const group of grouped) {
    const items = group.items;
    if (items.length === 0) continue;

    html += `<div class="notion-article-group"><h3>${group.title}</h3>`;
    for (const article of items) {
      const publicBadge = article.public
        ? '<span class="notion-badge notion-badge-public">公开</span>'
        : '<span class="notion-badge notion-badge-private">私密</span>';
      const date = formatDate(article.updatedAt || article.createdAt);

      html += `
        <div class="notion-article-card" data-id="${article.id}">
          <div class="notion-article-card-top">
            <strong>${article.title}</strong>
            ${publicBadge}
          </div>
          <div class="notion-article-card-meta">
            <small>${date}</small>
            <div class="notion-article-card-actions">
              <a href="/notes/article/?id=${article.id}" target="_blank" class="notion-action-link">查看</a>
              <button class="notion-action-link notion-delete-btn" data-id="${article.id}" type="button">删除</button>
            </div>
          </div>
        </div>`;
    }
    html += "</div>";
  }

  articlesList.innerHTML = html;

  // Bind delete buttons
  articlesList.querySelectorAll(".notion-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteArticle(btn.dataset.id));
  });
}

async function loadArticles() {
  try {
    const response = await fetch("/api/notion/articles");
    const data = await response.json();
    if (response.ok) {
      renderArticles(data.articles);
    } else {
      articlesList.innerHTML = `<p class="result-placeholder">加载失败：${data.error || "未知错误"}</p>`;
    }
  } catch {
    articlesList.innerHTML = '<p class="result-placeholder">无法连接后端。</p>';
  }
}

async function deleteArticle(id) {
  if (!confirm("确定要删除这篇文章吗？")) return;

  try {
    const response = await fetch(`/api/notion/articles/${id}`, { method: "DELETE" });
    if (response.ok) {
      loadArticles();
    }
  } catch {
    alert("删除失败。");
  }
}

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  const category = categoryInput.value;
  const isPublic = publicInput.value === "true";

  if (!url) {
    setStatus("warn", "请先粘贴 Notion 页面链接。");
    return;
  }

  importBtn.disabled = true;
  importBtn.textContent = "正在导入...";
  setStatus("", "正在从 Notion 拉取页面内容，请稍候...");

  try {
    const response = await fetch("/api/notion/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, category, public: isPublic })
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus("warn", `导入失败：${data.error || "未知错误"}`);
    } else {
      setStatus("ok", `已导入：${data.article.title}`);
      urlInput.value = "";
      loadArticles();
    }
  } catch {
    setStatus("warn", "请求失败，请检查网络或后端服务。");
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = "导入到网站";
  }
});

refreshBtn.addEventListener("click", loadArticles);

checkHealth();
loadArticles();
