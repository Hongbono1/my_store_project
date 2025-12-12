// controllers/storePrideRegisterController.js

/**
 * Store Pride Register(우리 가게 자랑 등록) 컨트롤러 팩토리
 * @param {import('pg').Pool} pool
 */
export function createStorePrideRegisterController(pool) {
  function buildFileMap(files = []) {
    const map = {};
    for (const f of files) map[f.fieldname] = f;
    return map;
  }

  /**
   * multer가 저장한 실제 파일 경로(file.path)를
   * 브라우저가 접근 가능한 공개 URL(/uploads/...)로 변환
   *
   * ✅ /data/uploads/...  -> /uploads/...
   * ✅ public/uploads/... -> /uploads/...
   */
  function publicPath(file) {
    if (!file) return null;

    const norm = String(file.path || "").replaceAll("\\", "/");

    // 1) 영구 저장 루트 매핑
    const base = "/data/uploads/";
    const idxBase = norm.indexOf(base);
    if (idxBase >= 0) {
      const rel = norm.slice(idxBase + base.length); // ex) storepride/xxx.jpg
      return `/uploads/${rel}`;
    }

    // 2) 프로젝트 내부 uploads 매핑
    const idxUp = norm.lastIndexOf("/uploads/");
    if (idxUp >= 0) {
      // ex) .../public/uploads/xxx.jpg -> /uploads/xxx.jpg
      return norm.slice(idxUp);
    }

    // 3) 최후 fallback
    return file.filename ? `/uploads/${file.filename}` : null;
  }

  /**
   * 등록: POST /api/storeprideregister/register
   */
  async function registerStorePrideRegister(req, res) {
    let client;
    let inTx = false;

    try {
      client = await pool.connect();

      const files = buildFileMap(req.files || []);
      const {
        store_name,
        category,
        phone = "",
        address,
        free_pr = "",
        qa_mode, // "fixed" | "custom"
      } = req.body || {};

      if (!store_name || !category || !address || !qa_mode) {
        return res.status(400).json({ success: false, error: "필수 항목 누락" });
      }

      await client.query("BEGIN");
      inTx = true;

      const mainImgPath = publicPath(files["main_img"]);
      if (!mainImgPath) {
        return res.status(400).json({ success: false, error: "대표 사진(main_img)이 없습니다." });
      }

      // 1) 메인 저장
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
      const prideId = rows?.[0]?.id;
      if (!prideId) throw new Error("등록 실패(pride_id 없음)");

      // 2) Q&A 저장
      const insertQaSql = `
        INSERT INTO store_pride_qas
          (pride_id, qa_type, seq, question, answer, image_path)
        VALUES ($1,$2,$3,$4,$5,$6)
      `;

      if (qa_mode === "fixed") {
        for (let i = 1; i <= 8; i++) {
          const q = (req.body?.[`q${i}_question`] || "").trim();
          const a = (req.body?.[`q${i}_answer`] || "").trim();
          if (!a) throw new Error(`질문 ${i}의 답변이 비어 있습니다.`);

          const img = publicPath(files[`q${i}_image`]);
          await client.query(insertQaSql, [prideId, "fixed", i, q, a, img]);
        }
      } else if (qa_mode === "custom") {
        let seq = 1;
        for (let i = 1; i <= 5; i++) {
          const qKey = `customq${i}_question`;
          const aKey = `customq${i}_answer`;

          if (!req.body?.[qKey] && !req.body?.[aKey]) continue;

          const q = (req.body?.[qKey] || "").trim();
          const a = (req.body?.[aKey] || "").trim();
          if (!q || !a) throw new Error(`자유질문 ${i}의 질문/답변이 비어 있습니다.`);

          const img = publicPath(files[`customq${i}_image`]);
          await client.query(insertQaSql, [prideId, "custom", seq, q, a, img]);
          seq++;
        }
      } else {
        throw new Error("알 수 없는 qa_mode");
      }

      await client.query("COMMIT");
      inTx = false;

      return res.json({ success: true, pride_id: prideId });
    } catch (e) {
      if (client && inTx) {
        try { await client.query("ROLLBACK"); } catch (_) {}
      }
      console.error("[storePrideRegister]", e);
      return res.status(500).json({ success: false, error: e.message });
    } finally {
      if (client) client.release();
    }
  }

  /**
   * 상세: GET /api/storeprideregister/:id
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

      if (main.rowCount === 0) return res.status(404).json({ ok: false, error: "not_found" });

      const qas = await pool.query(
        `SELECT qa_type, seq, question, answer, image_path
         FROM store_pride_qas
         WHERE pride_id=$1
         ORDER BY qa_type, seq`,
        [id]
      );

      return res.json({ ok: true, data: { ...main.rows[0], qas: qas.rows } });
    } catch (e) {
      console.error("[storePrideRegister detail]", e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return { registerStorePrideRegister, getStorePrideRegisterDetail };
}
