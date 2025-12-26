// routes/foodcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  getSlot,
  saveSlot,
  deleteSlot,
  searchStore,
  fixLinks,
  checkLinks,
} from "../controllers/foodcategorymanagerAdController.js";

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ✅ image / slotImage 둘 다 허용 + saveSlot(req.file) 호환
const uploadSlot = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
]);

router.get("/slot", getSlot);

router.post(
  "/slot",
  uploadSlot,
  (req, _res, next) => {
    const f =
      (req.files?.image && req.files.image[0]) ||
      (req.files?.slotImage && req.files.slotImage[0]) ||
      null;

    if (f) req.file = f;
    next();
  },
  saveSlot
);

router.delete("/slot", deleteSlot);
router.get("/store/search", searchStore);
router.get("/search-store", searchStore); // ✅ 별칭 추가 (ncategory2manager와 동일한 경로)

// ✅ 링크 수정 API
router.post("/fix-links/:tableSource", fixLinks);
router.get("/check-links", checkLinks);

// ✅ 실제 store_info 조회해서 내려주는 search-store
router.get("/search-store", async (req, res) => {
  try {
    const qRaw = (req.query.q || "").toString().trim();
    const q = (qRaw === "__all__") ? "" : qRaw;

    const params = [];
    let where = "";

    if (q) {
      params.push(`%${q}%`);
      where = `
        WHERE
          business_name ILIKE $1
          OR business_number ILIKE $1
          OR business_type ILIKE $1
          OR business_category ILIKE $1
          OR detail_category ILIKE $1
      `;
    }

    const sql = `
      SELECT
        id,
        business_number,
        business_name,
        business_type,
        business_category,
        detail_category,
        address,
        phone
      FROM public.store_info
      ${where}
      ORDER BY id DESC
      LIMIT 2000
    `;

    const { rows } = await pool.query(sql, params);

    return res.json({ ok: true, stores: rows });
  } catch (err) {
    console.error("[foodcategorymanager/search-store] error:", err);
    return res.status(500).json({ ok: false, message: "server error" });
  }
});

export default router;
