import pool from "../db.js";

/** 오늘의 테마용 핫서브 데이터 반환 */
export async function getHotSubTheme(req, res) {
  try {
    const q = `
      SELECT
        id,
        title,
        cover_image,
        store_name,
        category,
        qa_mode,
        phone,
        url,
        address,
        created_at
      FROM hotblogs
      WHERE qa_mode = 'theme' OR category = 'theme'
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const { rows } = await pool.query(q);
    return res.json({ ok: true, blogs: rows });
  } catch (err) {
    console.error("[getHotSubTheme] error:", err && err.message ? err.message : err);
    // 상세 디버그 확인을 위해 에러 메시지 일부만 반환(운영 환경이면 "internal"로 변경)
    return res.status(500).json({ ok: false, error: "데이터 오류", detail: String(err?.message || err) });
  }
}

export default { getHotSubTheme };
