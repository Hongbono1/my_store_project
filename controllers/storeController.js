// controllers/storeController.js
import { pool } from "../db/pool.js";

// 단일 가게 상세 조회
export async function getStoreById(req, res) {
  const { id } = req.params;

  try {
    const sql = `
      SELECT
        id,
        business_name        AS "businessName",
        phone_number         AS "phone",
        image1,
        image2,
        image3,
        business_category    AS "category",
        business_subcategory AS "subcategory",
        address,
        event1,
        event2,
        facility,
        pets,
        parking,
        service_details      AS "serviceDetails",
        homepage,
        instagram,
        facebook,
        description
      FROM store_info
      WHERE id = $1
    `;

    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Store not found" });
    }

    const store = rows[0];

    // ✅ images 배열로 묶기
    store.images = [store.image1, store.image2, store.image3].filter(Boolean);
    if (!store.images.length) {
      store.images = ["/images/no-image.png"];
    }

    // ✅ 썸네일 fallback
    store.thumbnailUrl = store.image1 || "/images/no-image.png";

    // ✅ 이벤트 배열로 묶기
    store.events = [store.event1, store.event2].filter(Boolean);

    // 👉 필요 시 description 출력용으로도 사용 가능
    store.additionalDescription = store.description || "";

    return res.json({ store });

  } catch (err) {
    console.error("🔴 getStoreById error:", err);
    res.status(500).json({ error: err.message });
  }
}
