// ncombinedregisterserver.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// DB 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 업로드 디렉토리 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + "_" + file.originalname.replace(/\s+/g, "_");
    cb(null, safe);
  },
});
const upload = multer({ storage });

// JSON + 정적
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// ✅ 통합 등록 API
app.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 10 },
    { name: "menuImage", maxCount: 50 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const body = req.body;
      const files = req.files || {};

      // DB 저장 예시
      const result = await pool.query(
        `INSERT INTO ncombined_register 
          (business_name, business_category, phone, email, address, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`,
        [
          body.businessName,
          body.businessCategory,
          body.phone,
          body.email,
          body.address,
        ]
      );

      res.json({ ok: true, id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
