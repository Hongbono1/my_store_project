// controllers/opendetailController.js
import pool from "../db.js";

/* ======================================================
   🟦 오픈예정 상세 조회 (GET /opendetail/:id)
   ====================================================== */
export async function getOpenDetailById(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, store_name, open_date, category, phone, description, address, lat, lng, image_path
       FROM open_stores
       WHERE id = $1`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: "데이터 없음" });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [getOpenDetailById] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

/* ======================================================
   🟩 오픈예정 전체 목록 조회 (GET /opendetail)
   ====================================================== */
export async function getAllOpenDetails(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, store_name, open_date, category, phone, description, address, lat, lng, image_path
       FROM open_stores
       ORDER BY id DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("❌ [getAllOpenDetails] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
