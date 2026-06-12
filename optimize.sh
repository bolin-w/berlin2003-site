#!/bin/bash
# 性能优化脚本

echo "🚀 开始优化网站资源..."

# 检查是否安装了必要的工具
command -v npx >/dev/null 2>&1 || { echo "需要安装 Node.js"; exit 1; }

# 压缩 CSS (使用 csso)
echo "📦 压缩 CSS 文件..."
for file in assets/*.css; do
  if [[ ! $file =~ \.min\. ]]; then
    filename=$(basename "$file" .css)
    npx csso "$file" --output "assets/${filename}.min.css" 2>/dev/null || echo "跳过 $file"
  fi
done

# 压缩 JS (使用 terser)
echo "📦 压缩 JS 文件..."
for file in assets/*.js; do
  if [[ ! $file =~ \.min\. ]]; then
    filename=$(basename "$file" .js)
    npx terser "$file" --compress --mangle --output "assets/${filename}.min.js" 2>/dev/null || echo "跳过 $file"
  fi
done

# 优化图片 (使用 imagemin)
echo "🖼️  优化图片..."
npx imagemin assets/*.{png,jpg,jpeg} --out-dir=assets/ 2>/dev/null || echo "图片优化需要 imagemin"

echo "✅ 优化完成！"
echo ""
echo "提示：在生产环境中，请在 HTML 中引用 .min.css 和 .min.js 文件"
