import pool from "../db.js";

export async function getOpenDetail(req, res) {
    try {
        const idParam = req.params.id;
        const storeId = parseInt(idParam, 10); // ← 정수로 변환

        if (isNaN(storeId)) {
            console.error("❌ Invalid store ID:", idParam);
            return res.status(400).json({ success: false, message: "유효하지 않은 ID입니다." });
        }

        const result = await pool.query(
            `
      SELECT id, store_name, open_date, category, phone, description, address, lat, lng, image_path, created_at
      FROM open_stores
      WHERE id = $1
      `,
            [storeId] // ← 반드시 정수형으로 전달
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "데이터를 찾을 수 없습니다." });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("오픈예정 상세조회 오류:", err);
        res.status(500).json({ success: false, message: "서버 오류", error: err.message });
    }
}
