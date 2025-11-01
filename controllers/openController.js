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
        
        // ID 유효성 검사
        const numericId = parseInt(id, 10);
        if (isNaN(numericId) || numericId <= 0) {
            return res.status(400).json({ success: false, error: "유효하지 않은 ID입니다" });
        }
        
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
            [numericId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: "데이터 없음" });
        }

        // opendetail.html에서 기대하는 형태로 응답
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [getOpenById] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
