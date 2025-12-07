import fs from "fs";
import path from "path";

console.log("=== 업로드 경로 진단 ===");

const uploadPaths = [
  "/data/uploads",
  "./public2/uploads", 
  path.join(process.cwd(), "public2", "uploads")
];

uploadPaths.forEach(p => {
  console.log(`\n📁 ${p}:`);
  try {
    if (fs.existsSync(p)) {
      const files = fs.readdirSync(p);
      console.log(`  ✅ 존재 (파일 ${files.length}개)`);
      files.slice(0, 5).forEach(f => {
        const stat = fs.statSync(path.join(p, f));
        console.log(`    - ${f} (${Math.round(stat.size/1024)}KB)`);
      });
    } else {
      console.log("  ❌ 디렉토리 없음");
    }
  } catch(e) {
    console.log(`  ⚠️  오류: ${e.message}`);
  }
});

// 권한 확인
console.log("\n=== 권한 확인 ===");
try {
  const testFile = "/data/uploads/test.txt";
  fs.writeFileSync(testFile, "test");
  console.log("✅ /data/uploads 쓰기 권한 OK");
  fs.unlinkSync(testFile);
} catch(e) {
  console.log("❌ /data/uploads 권한 오류:", e.message);
}