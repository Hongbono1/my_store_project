// controllers/storePrideRegisterController.js
import path from "path";

/**
 * Store Pride Register(우리 가게 자랑 등록) 컨트롤러 팩토리
 * @param {import('pg').Pool} pool
 */
export function createStorePrideRegisterController(pool) {
    /**
     * 파일 맵 쉽게 얻기 (multer.any() 사용 가정)
     */
    function buildFileMap(files = []) {
        const map = {};
        for (const f of files) {
            map[f.fieldname] = f;
        }
        return map;
    }

    /**
     * 업로드 파일에서 DB에 저장할 공개 경로 반환
     * (예: public/uploads/abc.jpg -> /uploads/abc.jpg)
     */
    function publicPath(file) {
        if (!file) return null;
        const idx = file.path.replaceAll("\\", "/").lastIndexOf("/uploads/");
        if (idx >= 0) return file.path.replaceAll("\\", "/").slice(idx + 8); // "uploads/..."
        // fallback: filename만
        return `/uploads/${file.filename}`;
    }

    /**
     * 등록: POST /api/storeprideregister/register
     * multipart/form-data (main_img, q1_image..q8_image, customq*_image)
     */
    async function registerStorePrideRegister(req, res) {
        const client = await pool.connect();
        try {
            const files = buildFileMap(req.files);
            const {
                store_name,
                category,
                phone = "",
                address,
                free_pr = "",
                qa_mode, // "fixed" | "custom"
            } = req.body;

            if (!store_name || !category || !address || !qa_mode) {
                return res.status(400).json({ success: false, error: "필수 항목 누락" });
            }

            // 트랜잭션 시작
            await client.query("BEGIN");

            // 1) 메인 테이블 저장
            const mainImgPath = publicPath(files["main_img"]);
            const insertMain = `
        INSERT INTO store_pride
          (store_name, category, phone, address, main_img, free_pr, qa_mode)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING id
      `;
            const { rows } = await client.query(insertMain, [
                store_name,
                category,
                phone,
                address,
                mainImgPath,
                free_pr,
                qa_mode,
            ]);
            const prideId = rows[0].id;

            // 2) Q&A 저장
            const insertQaSql = `
        INSERT INTO store_pride_qas
          (pride_id, qa_type, seq, question, answer, image_path)
        VALUES ($1,$2,$3,$4,$5,$6)
      `;

            if (qa_mode === "fixed") {
                // 고정 8문항: q1_question, q1_answer, q1_image ... q8_*
                for (let i = 1; i <= 8; i++) {
                    const q = req.body[`q${i}_question`] || "";
                    const a = req.body[`q${i}_answer`] || "";
                    if (!a.trim()) {
                        throw new Error(`질문 ${i}의 답변이 비어 있습니다.`);
                    }
                    const img = publicPath(files[`q${i}_image`]);
                    await client.query(insertQaSql, [prideId, "fixed", i, q, a, img]);
                }
            } else if (qa_mode === "custom") {
                // 최대 5문항: customq1_question, customq1_answer, customq1_image ...
                let seq = 1;
                for (let i = 1; i <= 5; i++) {
                    const qKey = `customq${i}_question`;
                    const aKey = `customq${i}_answer`;
                    if (!req.body[qKey] && !req.body[aKey]) continue; // 빈 슬롯 건너뜀
                    const q = (req.body[qKey] || "").trim();
                    const a = (req.body[aKey] || "").trim();
                    if (!q || !a) {
                        throw new Error(`자유질문 ${i}의 질문/답변이 비어 있습니다.`);
                    }
                    const img = publicPath(files[`customq${i}_image`]);
                    await client.query(insertQaSql, [prideId, "custom", seq, q, a, img]);
                    seq++;
                }
            } else {
                throw new Error("알 수 없는 qa_mode");
            }

            await client.query("COMMIT");
            return res.json({ success: true, pride_id: prideId });
        } catch (e) {
            await client.query("ROLLBACK");
            console.error("[storePrideRegister] ", e);
            return res.status(500).json({ success: false, error: e.message });
        } finally {
            client.release();
        }
    }

    /**
     * 상세: GET /api/storeprideregister/:id
     *  - storepridedetail.html 에서 상세 조회용
     */
    async function getStorePrideRegisterDetail(req, res) {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });

        try {
            const main = await pool.query(
                `SELECT id, store_name, category, phone, address, main_img, free_pr, qa_mode, created_at
         FROM store_pride WHERE id=$1`,
                [id]
            );
            if (main.rowCount === 0) {
                return res.status(404).json({ ok: false, error: "not_found" });
            }
            const qas = await pool.query(
                `SELECT qa_type, seq, question, answer, image_path
         FROM store_pride_qas
         WHERE pride_id=$1
         ORDER BY qa_type, seq`,
                [id]
            );
            return res.json({ ok: true, data: { ...main.rows[0], qas: qas.rows } });
        } catch (e) {
            console.error("[storePrideRegister detail] ", e);
            return res.status(500).json({ ok: false, error: e.message });
        }
    }

    return { registerStorePrideRegister, getStorePrideRegisterDetail };
}