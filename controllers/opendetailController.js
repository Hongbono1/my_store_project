import pool from "../db.js";

/* 오픈예정 상세보기 컨트롤러 */
export async function getOpenDetail(req, res) {
    try {
        const storeId = parseInt(req.params.id, 10);
        if (isNaN(storeId)) {
            return res.status(400).json({ success: false, message: "유효하지 않은 ID" });
        }

        const result = await pool.query(
            `
      SELECT id, store_name, open_date, category, phone, description, address, lat, lng, image_path, created_at
      FROM open_stores
      WHERE id = $1
      `,
            [storeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "해당 오픈정보를 찾을 수 없습니다." });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("오픈예정 상세조회 오류:", err);
        res.status(500).json({ success: false, message: "서버 오류", error: err.message });
    }
}
