import pool from "../db.js";
import path from "path";

/** 문자열 보정: undefined/null -> "" */
const s = (v) => (v == null ? "" : String(v).trim());
/** 숫자 보정 */
const n = (v) => {
  const num = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};
/** boolean 보정 (가능/true/1/yes) */
const b = (v) => {
  const t = String(v ?? "").trim();
  return ["가능", "true", "1", "yes", "on"].includes(t.toLowerCase());
};

/* ----------------------
 * 저장 (등록 처리)
 * ---------------------- */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const raw = req.body || {};
    const files = req.files || {};

    await client.query("BEGIN");

    // 기본 가게 정보 (빈문자라도 넣어 NOT NULL 회피)
    const storeSql = `
      INSERT INTO food_stores
        (business_name, business_type, business_category,
         business_hours, delivery_option, service_details,
         additional_desc, phone, homepage, instagram, facebook,
         facilities, pets_allowed, parking, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id
    `;

    const storeVals = [
      s(raw.businessName),
      s(raw.businessType),            // 폼엔 없지만 컬럼이 NOT NULL이면 빈문자 처리
      s(raw.mainCategory || raw.subCategory), // 메인/서브 중 있는 걸 우선
      s(raw.businessHours),
      s(raw.deliveryOption),          // 폼엔 없으면 빈문자
      s(raw.serviceDetails),
      s(raw.additionalDesc),
      s(raw.phoneNumber),
      s(raw.homepage),
      s(raw.instagram),
      s(raw.facebook),
      s(raw.facility),
      b(raw.pets),                    // "가능" -> true
      s(raw.parking),
      s(raw.roadAddress || raw.ownerAddress), // 주소가 어디에 왔든 우선값
    ];

    const storeResult = await client.query(storeSql, storeVals);
    const storeId = storeResult.rows[0].id;

    // 대표/갤러리 이미지 저장 (옵션)
    // 입력 name은 "storeImages" (없어도 오류 나지 않게 처리)
    if (Array.isArray(files.storeImages)) {
      for (const f of files.storeImages) {
        await client.query(
          `INSERT INTO food_store_images (store_id, url) VALUES ($1, $2)`,
          [storeId, `/uploads/${path.basename(f.path)}`]
        );
      }
    }

    // 메뉴 저장
    // 폼 name: menuName[], menuPrice[], (선택) menuCategory[], (선택) menuImage[]
    const names = Array.isArray(raw["menuName[]"])
      ? raw["menuName[]"]
      : raw.menuName
      ? [raw.menuName]
      : [];
    const prices = Array.isArray(raw["menuPrice[]"])
      ? raw["menuPrice[]"]
      : raw.menuPrice
      ? [raw.menuPrice]
      : [];
    const cats = Array.isArray(raw["menuCategory[]"])
      ? raw["menuCategory[]"]
      : []; // 없으면 "기타"

    // 메뉴 이미지 파일들(순서를 유지하려면 같은 name으로 업로드해야 함)
    const menuImages = Array.isArray(files["menuImage[]"])
      ? files["menuImage[]"]
      : []; // 없다면 빈 배열

    for (let i = 0; i < names.length; i++) {
      const category = s(cats[i]) || "기타";
      const name = s(names[i]);
      const price = n(prices[i]);

      // 이미지 파일이 있다면 같은 인덱스로 맵핑(없거나 짧으면 undefined)
      const imgFile = menuImages[i];
      const imageUrl = imgFile ? `/uploads/${path.basename(imgFile.path)}` : null;

      // description 컬럼이 없다면 삭제하세요.
      await client.query(
        `INSERT INTO food_menu_items (store_id, category, name, price, image_url, description)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [storeId, category, name, price, imageUrl, ""]
      );
    }

    // 이벤트 저장 (선택) - 테이블 없으면 이 블록 통째로 지우세요.
    const ev1 = s(raw.event1);
    const ev2 = s(raw.event2);
    if (ev1) {
      await client.query(
        `INSERT INTO store_events (store_id, ord, content) VALUES ($1,$2,$3)`,
        [storeId, 1, ev1]
      );
    }
    if (ev2) {
      await client.query(
        `INSERT INTO store_events (store_id, ord, content) VALUES ($1,$2,$3)`,
        [storeId, 2, ev2]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[createFoodStore] error:", err);
    // 에러 원인을 프론트에서 볼 수 있게 전달
    return res.status(500).json({ ok: false, error: "DB insert failed", message: err.message });
  } finally {
    client.release();
  }
}

/* ----------------------
 * 조회 (상세 보기)
 * ---------------------- */
export async function getFoodStoreFull(req, res) {
  try {
    const storeId = parseInt(req.params.id, 10);

    const store = (
      await pool.query(`SELECT * FROM food_stores WHERE id=$1`, [storeId])
    ).rows[0];

    const images = (
      await pool.query(`SELECT url FROM food_store_images WHERE store_id=$1`, [storeId])
    ).rows;

    // image_url, description 컬럼이 없다면 SELECT 항목에서 제거
    const menus = (
      await pool.query(
        `SELECT category, name, price, image_url, description
         FROM food_menu_items
         WHERE store_id=$1
         ORDER BY category, name`,
        [storeId]
      )
    ).rows;

    // store_events 테이블이 없으면 이 블록 제거
    const events = (
      await pool.query(
        `SELECT content FROM store_events WHERE store_id=$1 ORDER BY ord`,
        [storeId]
      )
    ).rows.map((r) => r.content);

    res.json({ ok: true, store, images, menus, events });
  } catch (err) {
    console.error("[getFoodStoreFull] error:", err);
    res.status(500).json({ ok: false, error: "DB fetch failed", message: err.message });
  }
}
