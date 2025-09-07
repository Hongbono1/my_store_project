// controllers/hotblogregisterController.js
import pool from "../db.js";

/**
 * 홍보 블로그 등록
 * - qa는 항상 JSON.stringify() 해서 저장
 */
// 컨트롤러 예시
export async function registerHotBlog(req, res) {
  try {
    const { title, store_name, category, qa_mode } = req.body;
    let { qa } = req.body;

    const userId = 1; // ⚠️ 현재는 로그인 시스템이 없으므로 user_id = 1로 고정 추후 로그인 기능 추가 시 req.user.id 로 교체해야 함


    // qa JSON 변환
    if (qa && typeof qa !== "string") {
      try {
        qa = JSON.stringify(qa);
      } catch (e) {
        console.error("[registerHotBlog] qa stringify 실패:", e);
        qa = "[]";
      }
    }

    await pool.query(
      `
      INSERT INTO hotblogs (user_id, title, store_name, category, qa_mode, qa, created_at)
      VALUES ($1,$2,$3,$4,$5,$6, now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        title       = EXCLUDED.title,
        store_name  = EXCLUDED.store_name,
        category    = EXCLUDED.category,
        qa_mode     = EXCLUDED.qa_mode,
        qa          = EXCLUDED.qa,
        created_at  = now()
      `,
      [userId, title, store_name, category, qa_mode, qa]
    );

    res.json({ ok: true, message: "오늘의 테마 추천 저장 완료" });
  } catch (err) {
    console.error("registerHotBlog error:", err);
    res.status(500).json({ ok: false, error: "DB insert/update failed" });
  }
}

/**
 * 홍보 블로그 단일 조회
 */
export async function getHotBlog(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM hotblogs WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "not_found" });
        }

        const blog = result.rows[0];

        // qa를 JSON.parse 해서 객체/배열로 반환 (프론트에서 그대로 사용 가능)
        try {
            blog.qa = JSON.parse(blog.qa || "[]");
        } catch {
            blog.qa = [];
        }

        res.json({ success: true, blog });
    } catch (err) {
        console.error("[getHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
