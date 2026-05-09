const titleEl = document.querySelector("#article-title");
const contentEl = document.querySelector("#article-content");
const categoryEl = document.querySelector("#article-category");
const dateEl = document.querySelector("#article-date");
const footerTitleEl = document.querySelector("#article-footer-title");

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");
  if (!articleId) { titleEl.textContent = "缺少文章 ID"; return; }

  try {
    const res = await fetch(`/api/notion/articles/${articleId}`);
    const data = await res.json();
    if (!res.ok) { titleEl.textContent = data.error || "文章不存在"; return; }

    const a = data.article;
    document.title = `Berlin2003 / ${a.title}`;
    titleEl.textContent = a.title;
    categoryEl.textContent = a.category;
    footerTitleEl.textContent = a.title;
    dateEl.textContent = formatDate(a.createdAt);
    contentEl.innerHTML = a.contentHtml || "<p>这篇文章没有内容。</p>";
  } catch { titleEl.textContent = "加载失败"; }
}

loadArticle();
