// controllers/foodregisterController.js
import pool from "../db.js";

/**
 * 등록: FormData 그대로 옴 (multipart/form-data)
 * 프론트는 반드시 businessName, roadAddress, phone 최소 전송
 * 응답: { ok:true, id:<DB가 만든 PK> }
 */
export async function createFoodStore(req, res) {
  try {
    const businessName = (req.body.businessName || "").trim();
    const roadAddress = (req.body.roadAddress || "").trim();
    const phone = (req.body.phone || "").trim();

    if (!businessName || !roadAddress) {
      return res.status(400).json({ ok: false, error: "businessName, roadAddress는 필수" });
    }

    const q = `
      INSERT INTO food_stores (business_name, road_address, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const { rows } = await pool.query(q, [businessName, roadAddress, phone || null]);

    // ★ SSOT: DB가 만든 id만 사용
    return res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * 조회: /foodregister/:id
 * 응답: { ok:true, store:{...} } | 404
 */
export async function getFoodStoreById(req, res) {
  try {
    const { id } = req.params;        // ★ 파라미터 이름 고정 :id
    const q = `
      SELECT id, business_name AS "businessName",
             road_address  AS "roadAddress",
             phone, created_at AS "createdAt"
      FROM food_stores
      WHERE id = $1
    `;
    const { rows } = await pool.query(q, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    return res.json({ ok: true, store: rows[0] });
  } catch (err) {
    console.error("[getFoodStoreById] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

export async function getFoodRegisterFull(req, res) {
  try {
    // id 가드 (22P02 예방)
    const raw = req.params.id;
    const idNum = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(idNum)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    // 기본 정보 (address=road_address 로 매핑)
    const q = `
      SELECT
        id,
        business_name,
        road_address AS address,
        phone,
        created_at
      FROM food_stores
      WHERE id = $1
    `;
    const { rows } = await pool.query(q, [idNum]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    // ndetail은 images/menus 배열을 기대 → 일단 빈 배열
    return res.json({
      ok: true,
      store: rows[0],
      images: [],
      menus: []
    });
  } catch (err) {
    console.error("[getFoodRegisterFull] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
