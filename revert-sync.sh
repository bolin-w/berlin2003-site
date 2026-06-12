set -euo pipefail
SRC=/tmp/revert-sync/.codex-revert-sync
for base in /home/ubuntu/site-upload /var/www/personal-site; do
  sudo mkdir -p "$base/assets" "$base/anime" "$base/contact" "$base/life" "$base/notes/article" "$base/projects" "$base/research" "$base/studio/anime" "$base/studio-logout"
  sudo install -m 644 "$SRC/index.html" "$base/index.html"
  sudo install -m 644 "$SRC/assets/home-lab.css" "$base/assets/home-lab.css"
  sudo install -m 644 "$SRC/assets/research-lab.css" "$base/assets/research-lab.css"
  sudo install -m 644 "$SRC/assets/section-lab.css" "$base/assets/section-lab.css"
  sudo install -m 644 "$SRC/anime/index.html" "$base/anime/index.html"
  sudo install -m 644 "$SRC/contact/index.html" "$base/contact/index.html"
  sudo install -m 644 "$SRC/life/index.html" "$base/life/index.html"
  sudo install -m 644 "$SRC/notes/index.html" "$base/notes/index.html"
  sudo install -m 644 "$SRC/notes/article/index.html" "$base/notes/article/index.html"
  sudo install -m 644 "$SRC/projects/index.html" "$base/projects/index.html"
  sudo install -m 644 "$SRC/research/index.html" "$base/research/index.html"
  sudo install -m 644 "$SRC/studio/index.html" "$base/studio/index.html"
  sudo install -m 644 "$SRC/studio/anime/index.html" "$base/studio/anime/index.html"
  sudo install -m 644 "$SRC/studio-logout/index.html" "$base/studio-logout/index.html"
done