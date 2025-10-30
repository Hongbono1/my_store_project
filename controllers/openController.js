// controllers/openController.js
import pool from "../db.js";

/* =========================================================
   1️⃣ 전체 오픈예정 목록 조회 (GET /open)
========================================================= */
export async function getOpenList(req, res) {
    try {
        const result = await pool.query(`
      SELECT 
        id,
        store_name,
        open_date,
        category,
        phone,
        description,
        address,
        lat,
        lng,
        image_path
      FROM open_stores
      ORDER BY id DESC;
    `);

        res.json(result.rows); // open.html에서 rows.map(...) 바로 사용 가능
    } catch (err) {
        console.error("❌ [getOpenList] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

/* =========================================================
   2️⃣ 단일 조회 (GET /open/:id)
========================================================= */
export async function getOpenById(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `
      SELECT 
        id,
        store_name,
        open_date,
        category,
        phone,
        description,
        address,
        lat,
        lng,
        image_path
      FROM open_stores
      WHERE id = $1;
      `,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: "데이터 없음" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ [getOpenById] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
