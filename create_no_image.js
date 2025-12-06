import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PNG 기반 Base64 이미지 (200x200, 그레이 배경)
const noImageBase64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAWdEVYdENyZWF0aW9uIFRpbWUAMTAvMTkvMjKzQYNFAAAAaElEQVR4nO3BMQEAAADCoPVPbQhfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GWAABAPgjFYkAAAAASUVORK5CYII=`;

// SVG 이미지 생성
const noImageSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#f3f4f6"/>
  <rect x="50" y="50" width="100" height="100" fill="#d1d5db" rx="10"/>
  <text x="100" y="95" text-anchor="middle" font-family="Arial" font-size="12" fill="#6b7280">No Image</text>
  <text x="100" y="115" text-anchor="middle" font-family="Arial" font-size="10" fill="#9ca3af">준비중</text>
</svg>`;

// 디렉토리 생성
const uploadDir = path.join(__dirname, "public2", "uploads");
const assetsDir = path.join(__dirname, "public2", "assets");

[uploadDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 디렉토리 생성: ${dir}`);
  }
});

// PNG 파일 생성 (Base64를 Buffer로 변환)
const pngBuffer = Buffer.from(noImageBase64.split(',')[1], 'base64');
fs.writeFileSync(path.join(uploadDir, "no-image.png"), pngBuffer);
fs.writeFileSync(path.join(assetsDir, "no-image.png"), pngBuffer);

// SVG 파일도 생성 (호환성용)
fs.writeFileSync(path.join(uploadDir, "no-image.svg"), noImageSvg);
fs.writeFileSync(path.join(assetsDir, "no-image.svg"), noImageSvg);

console.log("✅ no-image 파일들이 생성되었습니다:");
console.log("  - /uploads/no-image.png");
console.log("  - /assets/no-image.png");
console.log("  - /uploads/no-image.svg");
console.log("  - /assets/no-image.svg");