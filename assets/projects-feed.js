const projectContainer = document.querySelector("#project-notion-articles");

function formatProjectDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function isProjectCategory(category) {
  const value = String(category || "").toLowerCase();
  return ["项目", "项目记录", "project", "milestone", "roadmap"].some((key) => value.includes(key.toLowerCase()));
}

function renderProjects(articles) {
  if (!projectContainer) {
    return;
  }

  const items = (articles || []).filter((article) => isProjectCategory(article.category));
  if (!items.length) {
    projectContainer.hidden = true;
    return;
  }

  projectContainer.hidden = false;
  projectContainer.innerHTML = `
    <section class="section-lab-panel">
      <p class="section-lab-label">Notion / 项目记录</p>
      <h2>从 Notion 里接进来的项目文章</h2>
      <p>这里收的是项目推进中的原始记录、清单和阶段性沉淀，不和上面的项目概览重复写一遍。</p>
      <div class="section-lab-grid two" style="margin-top:18px;">
        ${items
          .map((article) => {
            const date = formatProjectDate(article.createdAt);
            return `
              <a class="section-lab-card" href="/notes/article/?id=${article.id}" style="text-decoration:none;color:inherit;">
                <span>${article.category || "项目记录"}</span>
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

async function loadProjects() {
  try {
    const res = await fetch("/api/notion/articles?public=true");
    const data = await res.json();
    if (res.ok) {
      renderProjects(data.articles);
    }
  } catch {
    if (projectContainer) {
      projectContainer.hidden = true;
    }
  }
}

loadProjects();
