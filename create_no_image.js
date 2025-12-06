import fs from "fs";
import path from "path";

// 간단한 SVG 기반 no-image 생성
const noImageSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#f3f4f6"/>
  <rect x="50" y="50" width="100" height="100" fill="#d1d5db" rx="10"/>
  <text x="100" y="95" text-anchor="middle" font-family="Arial" font-size="12" fill="#6b7280">No Image</text>
  <text x="100" y="115" text-anchor="middle" font-family="Arial" font-size="10" fill="#9ca3af">준비중</text>
</svg>`;

// 업로드 디렉토리에 no-image.svg 생성
const uploadDir = "public2/uploads";
const assetsDir = "public2/assets";

// 디렉토리 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 두 곳에 모두 배치
fs.writeFileSync(path.join(uploadDir, "no-image.svg"), noImageSvg);
fs.writeFileSync(path.join(assetsDir, "no-image.svg"), noImageSvg);

console.log("✅ no-image.svg 파일이 생성되었습니다:");
console.log("  - /uploads/no-image.svg");
console.log("  - /assets/no-image.svg");