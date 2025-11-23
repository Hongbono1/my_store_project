// controllers/inquiryDetailController.js
import pool from "../db.js";

/**
 * 문의 상세 조회
 * GET /api/inquiry/:id
 */
export async function getInquiryDetail(req, res, next) {
    try {
        const rawId = req.params.id;
        const id = Number(rawId);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                ok: false,
                message: "유효하지 않은 문의 번호입니다.",
            });
        }

        const { rows } = await pool.query(
            `
      SELECT
        id,
        inquiry_type,
        title,
        content,
        user_name,
        writer_name,
        writer_phone,
        writer_email,
        image1_path,
        image2_path,
        image3_path,
        created_at,
        answer,
        answered_at
      FROM inquiry
      WHERE id = $1
      `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "해당 문의 내역을 찾을 수 없습니다.",
            });
        }

        return res.json({
            ok: true,
            item: rows[0],
        });
    } catch (err) {
        console.error("❌ getInquiryDetail ERROR:", err);
        return next(err);
    }
}
