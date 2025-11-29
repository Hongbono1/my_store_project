// routes/openRouter.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// 목록(JSON)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        store_name,
        open_date,
        category,
        phone,
        description,
        address,
        address AS detail_address,  -- ✅ 실제 컬럼 address를 detail_address 별칭으로
        image_path
      FROM open_stores
      ORDER BY id DESC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ [openRouter] 목록 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 상세(JSON)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows, rowCount } = await pool.query(
      `
      SELECT
        id,
        store_name,
        open_date,
        category,
        phone,
        description,
        address,
        address AS detail_address,  -- ✅ 여기서도 동일하게 alias
        image_path
      FROM open_stores
      WHERE id = $1
      `,
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: "not_found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("❌ [openRouter] 상세 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
