// routes/openRouter.js (예시)
import express from "express";
import pool from "../db.js";
const router = express.Router();

// 목록(JSON) - 상대 경로 사용
router.get("/", async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT id, store_name, open_date, category, phone, description, address, detail_address, image_path
      FROM open_stores
      ORDER BY id DESC
    `);
    res.json({ success: true, data: rows.rows });
  } catch (err) {
    console.error("❌ [openRouter] 목록 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 상세(JSON) - 상대 경로 사용
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, store_name, open_date, category, phone, description, address, detail_address, image_path
       FROM open_stores WHERE id=$1`,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ success: false, error: "not_found" });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error("❌ [openRouter] 상세 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
