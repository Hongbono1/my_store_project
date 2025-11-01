import pool from "../db.js";

/* 오픈예정 상세조회 컨트롤러 */
export async function getOpenDetail(req, res) {
    try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "유효하지 않은 ID입니다.",
            });
        }

        const result = await pool.query(
            `
      SELECT 
        store_name, category, open_date, phone, address, description, 
        image_path, lat, lng 
      FROM open_stores 
      WHERE id = $1
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "해당 오픈예정 정보를 찾을 수 없습니다.",
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (err) {
        console.error("오픈예정 상세조회 오류:", err);
        res.status(500).json({
            success: false,
            message: "서버 오류로 상세정보를 불러올 수 없습니다.",
            error: err.message,
        });
    }
}
