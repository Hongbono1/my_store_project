import pool from "../db.js";

export async function getPerformingArtById(req, res) {
  try {
    const { id } = req.params;

    // 1) 메인 데이터 조회
    const result = await pool.query(
      `SELECT * FROM performing_arts WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "공연/예술 정보를 찾을 수 없습니다." });
    }

    const art = result.rows[0];

    // 2) 파일 조회 (이미지 + 팜플렛)
    const filesResult = await pool.query(
      `SELECT file_type, file_path FROM performing_arts_files WHERE art_id = $1 ORDER BY id`,
      [id]
    );

    art.files = filesResult.rows;

    return res.json({ success: true, data: art });
  } catch (err) {
    console.error("PERFORMING ART DETAIL ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
