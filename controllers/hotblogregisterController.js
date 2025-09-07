// controllers/hotblogregisterController.js
console.log("[DEBUG BODY]", req.body);
console.log("[DEBUG FILE]", req.file);
import pool from "../db.js";

/**
 * 홍보 블로그 등록
 * - qa는 항상 JSON.stringify() 해서 저장
 */
export async function registerHotBlog(req, res) {
    try {
        const { title, store_name, category, qa_mode } = req.body;
        let { qa } = req.body;

        const userId = 1; // ⚠️ 현재는 로그인 시스템이 없으므로 user_id = 1로 고정
        // 추후 로그인 기능 추가 시 req.user.id 로 교체해야 함

        // qa JSON 변환
        if (qa && typeof qa !== "string") {
            try {
                qa = JSON.stringify(qa);
            } catch (e) {
                console.error("[registerHotBlog] qa stringify 실패:", e);
                qa = "[]";
            }
        }

        const result = await pool.query(
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
      RETURNING id
      `,
            [userId, title, store_name, category, qa_mode, qa]
        );

        // 등록 or 갱신된 id 반환
        const blogId = result.rows[0].id;

        res.json({
            success: true,
            id: blogId,
            message: "오늘의 테마 추천 저장 완료"
        });
    } catch (err) {
        console.error("registerHotBlog error:", err);
        res.status(500).json({ success: false, error: "DB insert/update failed" });
    }
}


