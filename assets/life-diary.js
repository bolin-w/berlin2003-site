const diaryForm = document.querySelector("#life-diary-form");
const diaryTitle = document.querySelector("#diary-title");
const diaryMood = document.querySelector("#diary-mood");
const diaryTags = document.querySelector("#diary-tags");
const diaryContent = document.querySelector("#diary-content");
const diaryList = document.querySelector("#diary-list");
const diaryStatus = document.querySelector("#diary-status");
const diaryCount = document.querySelector("#diary-count");
const diaryReset = document.querySelector("#diary-reset");
const diarySubmit = document.querySelector("#diary-submit");
const diaryPhotos = document.querySelector("#diary-photos");
const photoDrop = document.querySelector("#life-photo-drop");
const photoPreview = document.querySelector("#life-photo-preview");
const emojiButtons = document.querySelectorAll("[data-emoji]");

let diaryItems = [];
let editingId = "";
let currentPhotos = [];

function setDiaryStatus(text, kind = "") {
  diaryStatus.textContent = text;
  diaryStatus.dataset.kind = kind;
}

async function diaryApi(path, options) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败。");
  }
  return data;
}

function formatDate(value) {
  if (!value) {
    return "刚刚";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function tagsFromInput(value) {
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function insertAtCursor(textarea, value) {
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = `${before}${value}${after}`;
  textarea.focus();
  const next = start + value.length;
  textarea.setSelectionRange(next, next);
}

function renderPhotoPreview() {
  photoPreview.innerHTML = "";
  if (!currentPhotos.length) {
    photoPreview.hidden = true;
    return;
  }

  photoPreview.hidden = false;
  currentPhotos.forEach((photo) => {
    const item = document.createElement("figure");
    item.className = "life-photo-item";

    const image = document.createElement("img");
    image.src = photo.dataUrl;
    image.alt = photo.name || "日记照片";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
      currentPhotos = currentPhotos.filter((entry) => entry.id !== photo.id);
      renderPhotoPreview();
    });

    item.append(image, remove);
    photoPreview.appendChild(item);
  });
}

function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/webp", 0.82);
}

async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片格式无法识别。"));
    img.src = dataUrl;
  });

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "photo.webp",
    dataUrl: canvasToDataUrl(canvas)
  };
}

async function addPhotos(files) {
  const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) {
    return;
  }

  const slots = Math.max(0, 6 - currentPhotos.length);
  if (!slots) {
    setDiaryStatus("每篇最多 6 张照片。", "warn");
    return;
  }

  setDiaryStatus("正在压缩照片...");
  const nextPhotos = [];
  for (const file of imageFiles.slice(0, slots)) {
    nextPhotos.push(await compressImage(file));
  }
  currentPhotos = [...currentPhotos, ...nextPhotos];
  diaryPhotos.value = "";
  renderPhotoPreview();
  setDiaryStatus(`已添加 ${nextPhotos.length} 张照片。`, "ok");
}

function fillForm(item) {
  editingId = item.id;
  diaryTitle.value = item.title || "";
  diaryMood.value = item.mood || "";
  diaryTags.value = (item.tags || []).join(", ");
  diaryContent.value = item.content || "";
  currentPhotos = Array.isArray(item.photos) ? [...item.photos] : [];
  renderPhotoPreview();
  diarySubmit.textContent = "保存修改";
  diaryReset.hidden = false;
  diaryContent.focus();
  setDiaryStatus("正在编辑一条旧记录。", "editing");
}

function resetForm() {
  editingId = "";
  diaryForm.reset();
  currentPhotos = [];
  renderPhotoPreview();
  diarySubmit.textContent = "记下这一篇";
  diaryReset.hidden = true;
}

function renderDiary() {
  diaryCount.textContent = `${diaryItems.length} entries`;
  diaryList.innerHTML = "";

  if (!diaryItems.length) {
    diaryList.innerHTML = `
      <article class="life-diary-empty">
        <span>Empty diary</span>
        <strong>还没有日记。</strong>
        <p>在上面写下第一条记录，保存后会按时间生成卡片。</p>
      </article>
    `;
    return;
  }

  diaryItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "life-diary-card";

    const meta = document.createElement("div");
    meta.className = "life-diary-card-meta";

    const date = document.createElement("span");
    date.textContent = formatDate(item.createdAt);
    meta.appendChild(date);

    if (item.mood) {
      const mood = document.createElement("span");
      mood.textContent = item.mood;
      meta.appendChild(mood);
    }

    const title = document.createElement("h2");
    title.textContent = item.title || "未命名记录";

    const content = document.createElement("p");
    content.className = "life-diary-card-content";
    content.textContent = item.content || "";

    const photos = document.createElement("div");
    photos.className = "life-diary-card-photos";
    (item.photos || []).forEach((photo) => {
      const image = document.createElement("img");
      image.src = photo.dataUrl;
      image.alt = photo.name || "日记照片";
      photos.appendChild(image);
    });

    const tags = document.createElement("div");
    tags.className = "life-diary-card-tags";
    (item.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.textContent = tag;
      tags.appendChild(chip);
    });

    const actions = document.createElement("div");
    actions.className = "life-diary-card-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => fillForm(item));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      const ok = confirm("确定删除这条日记吗？");
      if (!ok) {
        return;
      }
      await diaryApi(`/api/editor/diary/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await loadDiary();
      if (editingId === item.id) {
        resetForm();
      }
      setDiaryStatus("已删除一条记录。", "ok");
    });

    actions.append(edit, remove);
    card.append(meta, title, content);
    if (item.photos?.length) {
      card.appendChild(photos);
    }
    if (item.tags?.length) {
      card.appendChild(tags);
    }
    card.appendChild(actions);
    diaryList.appendChild(card);
  });
}

async function loadDiary() {
  setDiaryStatus("正在读取日记...");
  const data = await diaryApi("/api/editor/diary");
  diaryItems = data.items || [];
  renderDiary();
  setDiaryStatus("日记已同步。", "ok");
}

diaryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: diaryTitle.value,
    mood: diaryMood.value,
    tags: tagsFromInput(diaryTags.value),
    content: diaryContent.value,
    photos: currentPhotos
  };

  setDiaryStatus(editingId ? "正在保存修改..." : "正在保存新日记...");
  if (editingId) {
    await diaryApi(`/api/editor/diary/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  } else {
    await diaryApi("/api/editor/diary", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  resetForm();
  await loadDiary();
  setDiaryStatus("已保存。", "ok");
});

diaryReset.addEventListener("click", () => {
  resetForm();
  setDiaryStatus("已退出编辑模式。");
});

diaryPhotos.addEventListener("change", () => {
  addPhotos(diaryPhotos.files).catch((error) => setDiaryStatus(error.message, "warn"));
});

photoDrop.addEventListener("click", () => diaryPhotos.click());
photoDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  photoDrop.classList.add("is-dragging");
});
photoDrop.addEventListener("dragleave", () => {
  photoDrop.classList.remove("is-dragging");
});
photoDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  photoDrop.classList.remove("is-dragging");
  addPhotos(event.dataTransfer.files).catch((error) => setDiaryStatus(error.message, "warn"));
});

emojiButtons.forEach((button) => {
  button.addEventListener("click", () => insertAtCursor(diaryContent, button.dataset.emoji || ""));
});

renderPhotoPreview();

loadDiary().catch((error) => {
  setDiaryStatus(error.message, "warn");
});
