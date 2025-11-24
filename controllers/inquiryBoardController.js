// controllers/inquiryBoardController.js
import pool from "../db.js";

/**
 * 문의 게시판 목록 조회
 * GET /api/inquiry-board
 */
export async function listInquiryBoard(req, res, next) {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        inquiry_type,
        title,
        user_name,
        writer_name,
        writer_phone,
        writer_email,
        created_at,
        answer,
        answered_at
      FROM inquiry
      ORDER BY created_at DESC
      LIMIT 100
      `
    );

    return res.json({
      ok: true,
      items: rows,
    });
  } catch (err) {
    console.error("❌ listInquiryBoard ERROR:", err);
    return next(err);
  }
}
