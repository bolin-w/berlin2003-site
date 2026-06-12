const container = document.querySelector("#category-articles");
const params = new URLSearchParams(window.location.search);
const category = document.querySelector('meta[name="notes-category"]')?.content || params.get("name") || "";
const articleCountEl = document.querySelector("#article-count");
const titleEl = document.querySelector("#category-title");
const leadEl = document.querySelector("#category-lead");
const kickerEl = document.querySelector("#category-kicker");
const headingEl = document.querySelector("#category-heading");
const footerEl = document.querySelector("#category-footer");
const footerCopyEl = document.querySelector("#category-footer-copy");
const figureCopyEl = document.querySelector("#category-figure-copy");
const labelEl = document.querySelector("#category-label");

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function renderArticles(articles) {
  if (!articles || articles.length === 0) {
    container.innerHTML = `
      <div class="hx-empty-state" style="grid-column:1/-1;">
        <h3>暂无文章</h3>
        <p>这个分类还没有公开内容。</p>
      </div>`;
    return;
  }

  let html = "";
  for (const a of articles) {
    const date = formatDate(a.createdAt);
    const categoryLabel = a.category || category || "笔记";
    html += `
      <a class="hx-article-card" href="/notes/article/?id=${a.id}">
        <div class="hx-article-meta">
          <span class="hx-article-date">${date || "UNDATED"}</span>
          <span class="hx-article-cat">${categoryLabel}</span>
        </div>
        <h3>${a.title}</h3>
        <p>${a.summary || "打开这篇笔记，查看完整记录与当时的判断。"}</p>
        <div class="hx-article-tags">
          <span>${a.module || "笔记"}</span>
          <span>${categoryLabel}</span>
        </div>
      </a>`;
  }
  container.innerHTML = html;
}

async function load() {
  if (!category) {
    if (titleEl) titleEl.textContent = "未指定分类";
    if (leadEl) leadEl.textContent = "请通过固定分类页或 URL 参数传入分类名称。";
    if (container) {
      container.innerHTML = `
        <div class="hx-empty-state" style="grid-column:1/-1;">
          <h3>缺少分类</h3>
          <p>使用固定分类页，或带上 <code>?name=分类名</code> 访问。</p>
        </div>`;
    }
    return;
  }
  try {
    const res = await fetch(`/api/notion/articles?public=true&module=%E7%AC%94%E8%AE%B0&category=${encodeURIComponent(category)}`);
    const data = await res.json();
    if (titleEl) titleEl.textContent = category;
    if (headingEl) headingEl.textContent = `${category}文章`;
    if (footerEl) footerEl.textContent = category;
    if (footerCopyEl) footerCopyEl.textContent = category;
    if (labelEl) labelEl.textContent = category;
    if (kickerEl) kickerEl.textContent = category.toUpperCase();
    if (figureCopyEl) figureCopyEl.textContent = `收拢与“${category}”相关的公开记录，按导入顺序继续阅读。`;
    if (leadEl) leadEl.textContent = `当前分类为“${category}”，这里收拢同一路线下的公开笔记与阶段判断。`;
    if (res.ok) {
      const articles = data.articles || [];
      if (articleCountEl) articleCountEl.textContent = String(articles.length);
      renderArticles(articles);
    }
  } catch {
    container.style.display = "none";
  }
}

load();
