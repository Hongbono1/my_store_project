// controllers/storeController.js
import { pool } from "../db.js";

const ALLOWED = new Set(["가능", "불가", "일부 가능"]);

function normalizeDeliveryOption(input) {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (ALLOWED.has(v)) return v;

  const low = v.toLowerCase();
  if (["y","yes","true","delivery","deliver","배달가능"].includes(low)) return "가능";
  if (["n","no","false","pickup only","픽업","배달불가","불가능"].includes(low)) return "불가";
  return null; // 필수 정책이므로 허용 외는 null 처리 → 400
}

export async function createStore(req, res) {
  try {
    const {
      businessName,
      businessType,
      businessCategory,
      businessSubcategory,
      deliveryOption: rawDeliveryOption,
    } = req.body;

    const deliveryOption = normalizeDeliveryOption(rawDeliveryOption);
    if (!deliveryOption) {
      return res.status(400).json({
        ok: false,
        message: "배달 여부는 '가능', '불가', '일부 가능' 중 하나를 선택해야 합니다."
      });
    }

    const sql = `
      INSERT INTO store_info (
        business_name,
        business_type,
        business_category,
        business_subcategory,
        delivery_option
      ) VALUES ($1,$2,$3,$4,$5)
      RETURNING id
    `;
    const params = [
      businessName ?? null,
      businessType ?? null,
      businessCategory ?? null,
      businessSubcategory ?? null,
      deliveryOption
    ];

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, storeId: rows[0]?.id ?? null }); // ← 프론트와 맞춤
  } catch (e) {
    console.error("[createStore] insert error:", e);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
}

export async function getStoreDetail(req, res) {
  try {
    const sql = `
      SELECT
        id,
        business_name         AS "businessName",
        business_type         AS "businessType",
        business_category     AS "businessCategory",
        business_subcategory  AS "businessSubcategory",
        delivery_option       AS "deliveryOption"
      FROM store_info
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ ok: false, message: "not found" });
    return res.json({ ok: true, store: rows[0] });
  } catch (e) {
    console.error("[getStoreDetail] select error:", e);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
}
