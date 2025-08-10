// controllers/storeController.js
import { pool } from "../db.js";

// 값 정규화
function normalizeDeliveryOption(input) {
  if (typeof input !== "string") return "미입력";
  const v = input.trim();
  const allow = new Set(["가능", "불가", "일부 가능"]);
  if (allow.has(v)) return v;

  // 느슨한 매핑(혹시 다른 값이 오더라도 안전하게)
  const low = v.toLowerCase();
  if (["y", "yes", "true", "delivery", "deliver", "배달가능"].includes(low)) return "가능";
  if (["n", "no", "false", "pickup only", "픽업", "배달불가"].includes(low)) return "불가";
  return "미입력";
}

export async function createStore(req, res) {
  try {
    const {
      businessName,
      businessType,
      businessCategory,
      deliveryOption: rawDeliveryOption,
      // ... 다른 필드들 ...
    } = req.body;

    const deliveryOption = normalizeDeliveryOption(rawDeliveryOption);

    const sql = `
      INSERT INTO store_info (
        business_name,
        business_type,
        business_category,
        delivery_option
        -- ... 기타 컬럼
      ) VALUES ($1,$2,$3,$4)
      RETURNING id
    `;
    const params = [
      businessName ?? null,
      businessType ?? null,
      businessCategory ?? null,
      deliveryOption
    ];

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, id: rows[0]?.id ?? null });
  } catch (err) {
    console.error("[createStore] error:", err);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
}

export async function getStoreDetail(req, res) {
  try {
    const { id } = req.params;
    const sql = `
      SELECT
        id,
        business_name       AS "businessName",
        business_type       AS "businessType",
        business_category   AS "businessCategory",
        COALESCE(delivery_option, '미입력') AS "deliveryOption"
        -- ... 기타 컬럼도 전부 AS로 camelCase 통일 추천
      FROM store_info
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows[0]) return res.status(404).json({ ok: false, message: "not found" });

    // 방어적으로 한 번 더 보정
    rows[0].deliveryOption = normalizeDeliveryOption(rows[0].deliveryOption);

    return res.json({ ok: true, store: rows[0] });
  } catch (err) {
    console.error("[getStoreDetail] error:", err);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
}
