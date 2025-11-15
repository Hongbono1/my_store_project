// controllers/storeprideController.js
import pool from "../db/pool.js";

// ✔ 리스트 가져오기
export async function getStorePrideList(req, res) {
    try {
        const sql = `
      SELECT pride_id, store_name, category, main_image, created_at
      FROM store_pride
      ORDER BY pride_id DESC
    `;
        const result = await pool.query(sql);
        return res.json(result.rows);
    } catch (e) {
        console.error("❌ storepride/list error", e);
        return res.status(500).json({ ok: false, error: "server_error" });
    }
}


// ✔ 하나의 상세 데이터 가져오기 (substorepride.html?id=7)
export async function getStorePrideDetail(req, res) {
    const { id } = req.params;
    try {
        const sql = `
      SELECT pride_id, store_name, category, main_image, created_at
      FROM store_pride
      WHERE pride_id = $1
    `;
        const result = await pool.query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: "not_found" });
        }

        return res.json(result.rows[0]);
    } catch (e) {
        console.error("❌ storepride/detail error", e);
        return res.status(500).json({ ok: false, error: "server_error" });
    }
}
