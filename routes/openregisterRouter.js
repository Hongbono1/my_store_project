import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";

const router = express.Router();

// ✅ A 방식 표준 경로
const SUBDIR = "open";
const UPLOAD_DIR = `/data/uploads/${SUBDIR}`;

// 폴더 보장
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ✅ multer 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, fileName);
  },
});
const upload = multer({ storage });

// ------------------------------------------------------------
// ✅ 내부 유틸: detail_address 컬럼 없을 때 안전 폴백
// ------------------------------------------------------------
const COLUMN_NOT_FOUND = "42703";

async function insertOpenStore({
  store_name,
  open_date,
  category,
  phone,
  finalDescription,
  address,
  detail_address,
  imagePath,
}) {
  // 1차: detail_address 포함
  try {
    const result = await pool.query(
      `INSERT INTO open_stores 
       (store_name, open_date, category, phone, description, address, detail_address, image_path, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       RETURNING id`,
      [
        store_name,
        open_date,
        category || null,
        phone,
        finalDescription || null,
        address || null,
        detail_address || null,
        imagePath,
      ]
    );
    return result.rows[0].id;
  } catch (err) {
    // 컬럼 없으면 2차 폴백
    if (err?.code === COLUMN_NOT_FOUND) {
      const result = await pool.query(
        `INSERT INTO open_stores 
         (store_name, open_date, category, phone, description, address, image_path, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         RETURNING id`,
        [
          store_name,
          open_date,
          category || null,
          phone,
          finalDescription || null,
          address || null,
          imagePath,
        ]
      );
      return result.rows[0].id;
    }
    throw err;
  }
}

async function selectOpenList() {
  try {
    const result = await pool.query(
      `SELECT id, store_name, open_date, category, phone, description, address, detail_address, image_path, created_at
       FROM open_stores
       ORDER BY created_at DESC`
    );
    return result.rows;
  } catch (err) {
    if (err?.code === COLUMN_NOT_FOUND) {
      const result = await pool.query(
        `SELECT id, store_name, open_date, category, phone, description, address,
                NULL::text AS detail_address,
                image_path, created_at
         FROM open_stores
         ORDER BY created_at DESC`
      );
      return result.rows;
    }
    throw err;
  }
}

async function selectOpenOne(id) {
  try {
    const result = await pool.query(
      `SELECT id, store_name, open_date, category, phone, description, address, detail_address, image_path, created_at
       FROM open_stores
       WHERE id = $1`,
      [id]
    );
    return result;
  } catch (err) {
    if (err?.code === COLUMN_NOT_FOUND) {
      const result = await pool.query(
        `SELECT id, store_name, open_date, category, phone, description, address,
                NULL::text AS detail_address,
                image_path, created_at
         FROM open_stores
         WHERE id = $1`,
        [id]
      );
      return result;
    }
    throw err;
  }
}

// ------------------------------------------------------------
// ✅ 오픈예정 등록 API
// ------------------------------------------------------------
router.post("/", upload.single("img"), async (req, res) => {
  try {
    console.log("📝 [openregister] 요청 데이터:", req.body);
    console.log("📁 [openregister] 업로드된 파일:", req.file);

    const {
      store_name,
      open_date,
      category,
      phone,
      address,          // 기본 주소
      detail_address,   // 상세 주소
      description,      // 일반 텍스트 (구버전)
      descHtml          // 리치 텍스트 HTML
    } = req.body;

    const finalDescription = descHtml || description || "";

    if (!store_name || !open_date || !phone) {
      console.log("❌ 필수값 누락:", { store_name, open_date, phone });
      return res.json({ success: false, error: "필수 항목 누락 (상호명, 오픈일, 전화번호)" });
    }

    // ✅ DB에는 /uploads/open/<filename>만 저장
    const imagePath = req.file ? `/uploads/${SUBDIR}/${req.file.filename}` : null;

    console.log("💾 DB 저장 준비:", {
      store_name,
      open_date,
      category,
      phone,
      address,
      detail_address,
      imagePath
    });

    const newId = await insertOpenStore({
      store_name,
      open_date,
      category,
      phone,
      finalDescription,
      address,
      detail_address,
      imagePath
    });

    console.log("✅ [openregister] 등록 성공 - ID:", newId);
    res.json({ success: true, id: newId });

  } catch (err) {
    console.error("❌ [openregister] 오류:", err);
    res.status(500).json({
      success: false,
      error: "DB 저장 실패",
      message: err.message
    });
  }
});

// ------------------------------------------------------------
// ✅ 오픈예정 전체 조회 API
// ------------------------------------------------------------
router.get("/", async (_req, res) => {
  try {
    const rows = await selectOpenList();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ [openregister] 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------------
// ✅ 단일 조회 API
// ------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await selectOpenOne(id);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "데이터를 찾을 수 없습니다" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ [openregister] 단일 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
