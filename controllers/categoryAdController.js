// controllers/categoryAdController.js
import pool from "../db.js";

/**
 * 배너/이미지 슬롯 저장
 * - POST /manager/ad/upload
 * - body: page, position, link_url
 * - file: image (선택)
 */
export async function uploadManagerAd(req, res) {
  const { page, position, link_url } = req.body || {};
  const file = req.file || null;

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page와 position은 필수입니다.",
    });
  }

  const slotType = "banner";
  const imageUrl = file ? `/uploads/manager_ad/${file.filename}` : null;
  const linkUrl = (link_url || "").trim() || null;

  try {
    const result = await pool.query(
      `
      INSERT INTO admin_ad_slots (page, position, slot_type, image_url, link_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = EXCLUDED.slot_type,
        image_url = EXCLUDED.image_url,
        link_url = EXCLUDED.link_url,
        updated_at = NOW()
      RETURNING *
      `,
      [page, position, slotType, imageUrl, linkUrl]
    );

    return res.json({ ok: true, slot: result.rows[0] });
  } catch (err) {
    console.error("uploadManagerAd ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "배너 저장 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

/**
 * 텍스트 슬롯 저장
 * - POST /manager/ad/text/save
 * - body: page, position, content
 */
export async function saveTextSlot(req, res) {
  const { page, position, content } = req.body || {};

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page와 position은 필수입니다.",
    });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({
      ok: false,
      message: "표시할 텍스트를 입력해주세요.",
    });
  }

  const slotType = "text";

  try {
    const result = await pool.query(
      `
      INSERT INTO admin_ad_slots (page, position, slot_type, content)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = EXCLUDED.slot_type,
        content = EXCLUDED.content,
        updated_at = NOW()
      RETURNING *
      `,
      [page, position, slotType, content.trim()]
    );

    return res.json({ ok: true, slot: result.rows[0] });
  } catch (err) {
    console.error("saveTextSlot ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 저장 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

/**
 * (옵션) 슬롯 조회 – 나중에 category.html / index.html에서 사용
 * GET /manager/ad/slot?page=food_category&position=category_power_1
 */
export async function getSlot(req, res) {
  const { page, position } = req.query || {};

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page와 position은 필수입니다.",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM admin_ad_slots
      WHERE page = $1
        AND position = $2
      `,
      [page, position]
    );

    return res.json({ ok: true, slot: result.rows[0] || null });
  } catch (err) {
    console.error("getSlot ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "슬롯 조회 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

/**
 * (옵션) 텍스트 슬롯 조회
 * GET /manager/ad/text?page=food_category&position=category_main_text
 */
export async function getTextSlot(req, res) {
  const { page, position } = req.query || {};

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page와 position은 필수입니다.",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM admin_ad_slots
      WHERE page = $1
        AND position = $2
        AND slot_type = 'text'
      `,
      [page, position]
    );

    return res.json({ ok: true, slot: result.rows[0] || null });
  } catch (err) {
    console.error("getTextSlot ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 슬롯 조회 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

/**
 * (옵션) 슬롯 조회 – 나중에 category.html / index.html에서 사용
 * GET /manager/ad/slot?page=food_category&position=category_power_1
 */
export async function getSlots(req, res) {
  const { page, position } = req.query || {};

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page와 position은 필수입니다.",
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM admin_ad_slots
      WHERE page = $1
        AND position = $2
      `,
      [page, position]
    );

    return res.json({
      ok: true,
      items: result.rows,
    });
  } catch (err) {
    console.error("getSlots ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "슬롯 조회 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

// ===============================
// 🍱 FOOD CATEGORY 목록 조회
// ===============================
export async function getFoodCategories(req, res) {
  try {
    const result = await pool.query("SELECT * FROM food_categories ORDER BY id ASC");
    res.json({ ok: true, categories: result.rows });
  } catch (err) {
    console.error("getFoodCategories ERROR:", err);
    res.status(500).json({ ok: false, message: "DB 조회 오류" });
  }
}

// ===============================
// 🍱 FOOD CATEGORY 추가
// ===============================
export async function createFoodCategory(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, message: "이름 누락" });
    const result = await pool.query(
      "INSERT INTO food_categories (name) VALUES ($1) RETURNING id",
      [name]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("createFoodCategory ERROR:", err);
    res.status(500).json({ ok: false, message: "추가 오류" });
  }
}

// ===============================
// 🍱 FOOD CATEGORY 삭제 (소프트 삭제)
// ===============================
export async function deleteFoodCategory(req, res) {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM food_categories WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteFoodCategory ERROR:", err);
    res.status(500).json({ ok: false, message: "삭제 오류" });
  }
}

// ===============================
// 🔗 단순 이미지/링크 업로드
// ===============================
export async function saveCategoryBanner(req, res) {
  try {
    const { page, position, link_url } = req.body;
    const file = req.file;
    const imageUrl = file ? `/uploads/category_ad/${file.filename}` : null;

    const sql = `
      INSERT INTO category_ad_slots (page, position, slot_type, image_url, link_url)
      VALUES ($1, $2, 'banner', $3, $4)
      ON CONFLICT (page, position)
      DO UPDATE SET image_url = EXCLUDED.image_url, link_url = EXCLUDED.link_url, updated_at = NOW()
      RETURNING id;
    `;
    const result = await pool.query(sql, [page, position, imageUrl, link_url]);
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("saveCategoryBanner ERROR:", err);
    res.status(500).json({ ok: false, message: "배너 저장 오류" });
  }
}

/**
 * (옵션) 사업자번호 + 상호로 가게를 슬롯에 연결
 * - POST /manager/ad/assign/store
 * - body: page, position, business_no, business_name
 */
export async function assignStoreToSlot(req, res) {
  const { page, position, business_no, business_name } = req.body || {};

  if (!page || !position) {
    return res.status(400).json({ ok: false, message: "슬롯 정보가 없습니다." });
  }
  if (!business_no || !business_name) {
    return res.status(400).json({ ok: false, message: "사업자번호와 상호를 모두 입력해주세요." });
  }

  try {
    // 1) 사업자번호 + 상호명으로 가게 검색
    const storeResult = await pool.query(
      `
      SELECT id, business_name, business_no, main_image_url
      FROM food_stores
      WHERE business_no = $1
        AND business_name = $2
      LIMIT 1
      `,
      [business_no.trim(), business_name.trim()]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "일치하는 가게를 찾을 수 없습니다.",
      });
    }

    const store = storeResult.rows[0];

    // 2) 이 가게의 상세 링크 자동 생성 (예: ndetail.html)
    const linkUrl = `/ndetail.html?id=${store.id}&type=food`;

    // 3) admin_ad_slots에 저장 (이미지/링크는 가게 기준으로)
    await pool.query(
      `
      INSERT INTO admin_ad_slots (page, position, slot_mode, store_id, business_no, business_name, link_url, image_url)
      VALUES ($1, $2, 'store', $3, $4, $5, $6, $7)
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_mode = 'store',
        store_id = EXCLUDED.store_id,
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        link_url = EXCLUDED.link_url,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
      `,
      [
        page,
        position,
        store.id,
        store.business_no,
        store.business_name,
        linkUrl,
        store.main_image_url || null,
      ]
    );

    return res.json({ 
      ok: true, 
      store: {
        id: store.id,
        business_name: store.business_name,
        business_no: store.business_no,
        link_url: linkUrl,
        image_url: store.main_image_url
      }
    });
  } catch (err) {
    console.error("assignStoreToSlot ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "광고 슬롯에 가게를 연결하는 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

// ===============================
// 🔍 사업자번호로 가게 검색 (자동완성용)
// ===============================
export async function searchStoreByBusiness(req, res) {
  const { business_no } = req.query || {};

  if (!business_no || business_no.length < 3) {
    return res.json({ ok: true, stores: [] });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, business_name, business_no, main_image_url
      FROM food_stores
      WHERE business_no LIKE $1
      ORDER BY business_name ASC
      LIMIT 10
      `,
      [`%${business_no.trim()}%`]
    );

    return res.json({ 
      ok: true, 
      stores: result.rows 
    });
  } catch (err) {
    console.error("searchStoreByBusiness ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "가게 검색 중 오류가 발생했습니다.",
      error: err.message,
    });
  }
}

// ==============================
// 🔹 카테고리 광고 슬롯 업로드 API
// ==============================
export async function uploadCategoryAd(req, res) {
  try {
    const {
      page,
      position,
      slotType = "image",
      linkUrl,
      textContent,
      slotMode = "admin",
      storeId,
      businessNo,
      businessName,
      startDate,
      endDate,
    } = req.body;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page, position이 필요합니다.",
      });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // UPSERT 쿼리
    const sql = `
      INSERT INTO admin_ad_slots (
        page, position, slot_type, image_url, link_url, text_content,
        slot_mode, store_id, business_no, business_name,
        start_date, end_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = EXCLUDED.slot_type,
        image_url = EXCLUDED.image_url,
        link_url = EXCLUDED.link_url,
        text_content = EXCLUDED.text_content,
        slot_mode = EXCLUDED.slot_mode,
        store_id = EXCLUDED.store_id,
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      page,
      position,
      slotType,
      imageUrl,
      linkUrl || null,
      textContent || null,
      slotMode,
      storeId || null,
      businessNo || null,
      businessName || null,
      startDate || null,
      endDate || null,
    ];

    const { rows } = await pool.query(sql, values);

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("UPLOAD CATEGORY AD ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "광고 업로드 오류",
      code: "CATEGORY_AD_UPLOAD_ERROR",
    });
  }
}

/**
 * (옵션) 카테고리 광고 슬롯 조회 API
 * GET /manager/ad/category/slot?page=food_category&position=category_power_1
 */
export async function getCategorySlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page, position이 필요합니다.",
      });
    }

    const sql = `
      SELECT
        id, page, position, slot_type, image_url, link_url, text_content,
        slot_mode, store_id, business_no, business_name,
        start_date, end_date, created_at, updated_at
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position]);

    if (rows.length === 0) {
      return res.json({
        ok: true,
        slot: null,
      });
    }

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("GET CATEGORY SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "슬롯 조회 오류",
      code: "CATEGORY_SLOT_LOAD_ERROR",
    });
  }
}
