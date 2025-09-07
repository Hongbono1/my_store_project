// controllers/hotblogregisterController.js
import pool from "../db.js";

/** 프런트와 동일한 질문 세트 (서버도 알고 있게) */
const THEME_QUESTIONS = [
    "오늘의 테마와 가게가 잘 맞는 이유는 무엇인가요?",
    "이 테마와 어울리는 대표 메뉴(또는 서비스)는 무엇인가요?",
    "계절·날씨·상황과 잘 어울리는 부분은 무엇인가요?",
    "이 테마에서 손님들이 가장 좋아하는 점은 무엇인가요?",
    "테마와 관련된 특별 이벤트나 혜택이 있나요?",
    "테마와 어울리는 공간(분위기/인테리어)이 있다면 소개해주세요.",
    "손님들에게 이 테마를 꼭 추천하고 싶은 이유는 무엇인가요?",
    "사장님이 생각하는 ‘오늘의 테마’와 가게의 핵심 매력은 무엇인가요?"
];

const RANDOM_QUESTIONS = [
    "가게의 대표 메뉴(또는 서비스)는 무엇인가요?",
    "단골손님들이 가장 많이 찾는 이유는 무엇인가요?",
    "처음 방문하는 손님들에게 꼭 추천하고 싶은 것은 무엇인가요?",
    "가게 운영에 있어 가장 중요하게 생각하는 가치는 무엇인가요?",
    "우리 가게만의 특별한 서비스나 자랑거리는 무엇인가요?",
    "손님들에게 가장 많이 듣는 칭찬은 무엇인가요?",
    "앞으로 손님들에게 어떤 가게로 기억되고 싶으신가요?",
    "사장님이 생각하는 우리 가게의 가장 큰 매력은 무엇인가요?"
];

/** 홍보 블로그 등록 */
export async function registerHotBlog(req, res) {
    try {
        const { title, store_name, category, qa_mode, phone, url } = req.body || {};
        if (!title || !store_name || !category || !qa_mode) {
            return res.status(400).json({
                success: false,
                error: "missing_fields",
                require: {
                    title: !!title,
                    store_name: !!store_name,
                    category: !!category,
                    qa_mode: !!qa_mode,
                },
            });
        }

        // 파일 맵 (필드명 → 업로드 URL)
        const filesByField = {};
        (req.files || []).forEach((f) => {
            filesByField[f.fieldname] = `/uploads/${f.filename}`;
        });

        // 대표 이미지
        const coverImage = filesByField["coverImage"] || null;

        // qa 구성
        let qa = [];
        if (qa_mode === "theme" || qa_mode === "random") {
            const base = qa_mode === "theme" ? THEME_QUESTIONS : RANDOM_QUESTIONS;
            qa = base.map((q, i) => {
                const a = (req.body[`${qa_mode}_q${i + 1}_answer`] ?? "").toString();
                const image_url = filesByField[`${qa_mode}_q${i + 1}_image`] || null;
                return { q, a, image_url };
            });
        } else if (qa_mode === "self") {
            // self는 최대 8개 수집
            for (let i = 1; i <= 8; i++) {
                const q = (req.body[`custom_q${i}_question`] ?? "").toString().trim();
                const a = (req.body[`custom_q${i}_answer`] ?? "").toString();
                if (!q && !a) continue;
                const image_url = filesByField[`custom_q${i}_image`] || null;
                qa.push({ q, a, image_url });
            }
        } else {
            // 혹시 모드가 이상하면 클라이언트가 실은 qa JSON 사용 시도
            try { qa = JSON.parse(req.body.qa || "[]"); } catch { qa = []; }
        }

        const userId = 1; // TODO: 로그인 붙이면 교체
        const result = await pool.query(
            `
      INSERT INTO hotblogs
        (user_id, title, store_name, category, qa_mode, qa, phone, url, cover_image, created_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
      RETURNING id
      `,
            [userId, title, store_name, category, qa_mode, JSON.stringify(qa), phone || null, url || null, coverImage]
        );

        return res.json({ success: true, id: result.rows[0].id, message: "홍보 블로그 저장 완료" });
    } catch (err) {
        console.error("registerHotBlog error:", err);
        return res.status(500).json({ success: false, error: "DB insert failed", detail: err?.message });
    }
}

/** 홍보 블로그 단일 조회 */
export async function getHotBlog(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT * FROM hotblogs WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: "not_found" });

        const blog = result.rows[0];
        try { blog.qa = JSON.parse(blog.qa || "[]"); } catch { blog.qa = []; }
        res.json({ success: true, blog });
    } catch (err) {
        console.error("[getHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
