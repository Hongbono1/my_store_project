// controllers/indexmanagerAdController.js
import pool from "../db.js";

/**
 * ✅ Boolean 정규화 유틸
 * - "true"/"false", 1/0, on/off 등 혼용 대응
 */
function toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "on" || s === "yes";
  }
  return false;
}

/**
 * ✅ 바디 키를 프론트/서버 혼용 케이스까지 안전 매핑
 * - 업로드/가게연결/텍스트/기간 공통 대응
 */
function pickBody(req) {
  const b = req?.body || {};

  const noEndRaw = b.noEnd ?? b.no_end ?? false;

  return {
    // 필수
    page: b.page,
    position: b.position,

    // 타입/모드
    slotType: b.slotType || b.slot_type,
    slotMode: b.slotMode || b.slot_mode,

    // 링크/텍스트
    linkUrl: b.linkUrl || b.link_url || b.link,
    textContent: b.textContent || b.text_content || b.content,

    // 가게 연결
    storeId: b.storeId || b.store_id,
    businessNo:
      b.businessNo ||
      b.business_no ||
      b.biz_number ||
      b.bizNo ||
      b.business_number,
    businessName: b.businessName || b.business_name || b.biz_name,

    // 기간
    startDate: b.startDate || b.start_date || null,
    endDate: b.endDate || b.end_date || null,
    noEnd: toBool(noEndRaw),
  };
}

/**
 * page/position 유효성 검사
 */
function ensurePagePosition(page, position) {
  if (!page || !position) {
    const error = new Error("page와 position은 필수입니다.");
    error.statusCode = 400;
    throw error;
  }
}

/* =========================
 * ✅ 대표 이미지 조회 유틸 (Neon 구조 방어형)
 * - 테이블/컬럼 존재 여부를 런타임에 확인
 * - bizNo 숫자만 비교
 * - /data/uploads/* → /uploads/* 표준화
 * ========================= */

function normalizeUploadPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (!s) return null;

  if (s.startsWith("/data/uploads/")) return s.replace("/data/uploads", "/uploads");
  if (s.startsWith("uploads/")) return "/" + s.replace(/^\/?/, "");
  return s;
}

async function hasColumn(table, col) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1`,
    [table, col]
  );
  return rows.length > 0;
}

async function buildSafeOrderClause(table) {
  if (await hasColumn(table, "updated_at")) return "updated_at DESC NULLS LAST, id DESC";
  if (await hasColumn(table, "created_at")) return "created_at DESC NULLS LAST, id DESC";
  if (await hasColumn(table, "id")) return "id DESC";
  return "1";
}

async function findImageColumns(table) {
  const candidates = [
    // ✅ 사용자가 Neon에서 추가했을 가능성 높은 컬럼들
    "main_image_url",
    "business_cert_path",

    // 일반 후보
    "main_img",
    "main_image",
    "image1",
    "image2",
    "image3",
    "image_url",
    "thumbnail_url",
    "thumb_url",
    "banner_image_url",
    "img1",
    "img2",
    "img3",
    "photo1",
    "photo2",
    "photo3",
    "store_image",
    "store_main_image",
    "rep_img",
    "represent_img",
    "images",
  ];

  const { rows } = await pool.query(
    `SELECT DISTINCT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND (
          column_name = ANY($2::text[])
          OR column_name ILIKE '%img%'
          OR column_name ILIKE '%image%'
          OR column_name ILIKE '%photo%'
          OR column_name ILIKE '%thumb%'
        )
      ORDER BY array_position($2::text[], column_name) NULLS LAST, column_name`,
    [table, candidates]
  );

  return rows.map((r) => r.column_name);
}

async function findBizNoColumn(table) {
  const candidates = [
    // ✅ Neon에서 실제로 쓰는 컬럼명 우선
    "business_number",

    // 일반 후보
    "business_no",
    "biz_no",
    "biz_number",
    "registration_no",
    "reg_no",
    "brn",
    "corp_no",
  ];

  const { rows } = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = ANY($2::text[])
      ORDER BY array_position($2::text[], column_name)
      LIMIT 1`,
    [table, candidates]
  );

  return rows[0]?.column_name || null;
}

async function buildBizNoWhere(table) {
  const col = await findBizNoColumn(table);
  if (!col) return { where: "FALSE", col: null };
  const where = `regexp_replace(COALESCE(${col}::text, ''), '[^0-9]', '', 'g') = $1`;
  return { where, col };
}

function pickStoreImage(storeRow) {
  if (!storeRow) return "";

  const candidates = [
    // ✅ Neon 우선 후보
    "main_image_url",
    "business_cert_path",

    // 일반 후보
    "image_url",
    "thumbnail_url",
    "thumb_url",
    "banner_image_url",
    "main_img",
    "main_image",
    "image1",
    "img1",
    "photo1",
    "store_image",
    "store_main_image",
  ];

  for (const key of candidates) {
    const v = storeRow[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const images = storeRow.images;
  if (Array.isArray(images) && images[0]) return String(images[0]);

  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed) && parsed[0]) return String(parsed[0]);
    } catch (_) { }
  }

  return "";
}

async function pickRepFromTableByBiz(table, biz) {
  const { where } = await buildBizNoWhere(table);
  if (!where || where === "FALSE") return null;

  const cols = await findImageColumns(table);
  if (!cols.length) return null;

  const orderClause = await buildSafeOrderClause(table);

  const hasImages = cols.includes("images");
  const simpleCols = cols.filter((c) => c !== "images");

  if (simpleCols.length) {
    const expr = simpleCols
      .map((c) => `NULLIF(TRIM(COALESCE(${c}::text,'')), '')`)
      .join(", ");

    const sql = `
      SELECT COALESCE(${expr}) AS rep
           ${hasImages ? ", images" : ""}
      FROM ${table}
      WHERE ${where}
      ORDER BY ${orderClause}
      LIMIT 1
    `;

    const r = await pool.query(sql, [biz]);
    const row = r.rows?.[0];

    if (row?.rep) return normalizeUploadPath(row.rep);

    if (hasImages && row?.images) {
      const raw = row.images;

      if (Array.isArray(raw) && raw[0]) return normalizeUploadPath(String(raw[0]));

      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed[0]) {
            return normalizeUploadPath(String(parsed[0]));
          }
        } catch (_) { }
      }
    }
  } else if (hasImages) {
    const sql = `
      SELECT images
      FROM ${table}
      WHERE ${where}
      ORDER BY ${orderClause}
      LIMIT 1
    `;
    const r = await pool.query(sql, [biz]);
    const raw = r.rows?.[0]?.images;

    if (Array.isArray(raw) && raw[0]) return normalizeUploadPath(String(raw[0]));

    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed[0]) return normalizeUploadPath(String(parsed[0]));
      } catch (_) { }
    }
  }

  return null;
}

/**
 * ✅ [필수] store 모드 슬롯 보강에서 호출되는 대표이미지 함수
 */
export async function getRepImageByBizNo(bizNoRaw) {
  if (!bizNoRaw) return null;

  const biz = String(bizNoRaw).replace(/[^0-9]/g, "").trim();
  if (!biz) return null;

  // ✅ 우선순위: combined_store_info → food_stores → store_info
  const tables = ["combined_store_info", "food_stores", "store_info"];

  for (const t of tables) {
    try {
      const rep = await pickRepFromTableByBiz(t, biz);
      if (rep) return rep;
    } catch (e) {
      console.warn(`[getRepImageByBizNo] ${t} 조회 스킵:`, e.message);
    }
  }

  return null;
}

/* =========================
 * ✅ 가게 조회 유틸
 * ========================= */

async function findFoodStoreById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM food_stores WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function findFoodStoreByName(name) {
  try {
    const { rows } = await pool.query(
      `SELECT *
         FROM food_stores
        WHERE business_name = $1
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [name]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function findCombinedStoreById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM combined_store_info WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function findCombinedStoreByName(name) {
  try {
    const { rows } = await pool.query(
      `SELECT *
         FROM combined_store_info
        WHERE business_name = $1
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [name]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * ✅ bizNo + businessName을 함께 써서 "정확히 그 가게"를 찾는 함수
 */
async function findStoreIdByBizAndName(cleanBizNo, businessName) {
  // 1) combined_store_info 우선
  try {
    const { where: whereCombined, col: combinedCol } =
      await buildBizNoWhere("combined_store_info");

    if (combinedCol && whereCombined && whereCombined !== "FALSE") {
      const r = await pool.query(
        `SELECT id
           FROM combined_store_info
          WHERE ${whereCombined}
            AND business_name = $2
          ORDER BY created_at DESC NULLS LAST, id DESC
          LIMIT 1`,
        [cleanBizNo, businessName]
      );
      if (r.rows[0]?.id) return Number(r.rows[0].id);
    }
  } catch (e) {
    console.warn("combined_store_info 매핑 실패:", e.message);
  }

  // 2) food_stores fallback
  try {
    const { where: whereFood, col: foodCol } = await buildBizNoWhere("food_stores");

    if (foodCol && whereFood && whereFood !== "FALSE") {
      const r = await pool.query(
        `SELECT id
           FROM food_stores
          WHERE ${whereFood}
            AND business_name = $2
          ORDER BY created_at DESC NULLS LAST, id DESC
          LIMIT 1`,
        [cleanBizNo, businessName]
      );
      if (r.rows[0]?.id) return Number(r.rows[0].id);
    }
  } catch (e) {
    console.warn("food_stores 매핑 실패:", e.message);
  }

  // 3) bizNo-only fallback
  try {
    const { where: whereCombined, col: combinedCol } =
      await buildBizNoWhere("combined_store_info");

    if (combinedCol && whereCombined && whereCombined !== "FALSE") {
      const r = await pool.query(
        `SELECT id
           FROM combined_store_info
          WHERE ${whereCombined}
          ORDER BY created_at DESC NULLS LAST, id DESC
          LIMIT 1`,
        [cleanBizNo]
      );
      if (r.rows[0]?.id) return Number(r.rows[0].id);
    }
  } catch (_) { }

  try {
    const { where: whereFood, col: foodCol } = await buildBizNoWhere("food_stores");

    if (foodCol && whereFood && whereFood !== "FALSE") {
      const r = await pool.query(
        `SELECT id
           FROM food_stores
          WHERE ${whereFood}
          ORDER BY created_at DESC NULLS LAST, id DESC
          LIMIT 1`,
        [cleanBizNo]
      );
      if (r.rows[0]?.id) return Number(r.rows[0].id);
    }
  } catch (_) { }

  return null;
}

/**
 * ✅ store 모드 슬롯 해석기
 * - slot 객체에 image_url/link_url/store_id 보강
 */
async function resolveStoreModeSlot(slot) {
  if (!slot || slot.slot_mode !== "store") return slot;

  let storeRow = null;
  let resolvedType = "food";

  // 1) store_id 우선
  if (slot.store_id) {
    storeRow = await findFoodStoreById(slot.store_id);

    if (!storeRow) {
      storeRow = await findCombinedStoreById(slot.store_id);
      if (storeRow) resolvedType = "store";
    }
  }

  // 2) business_name 기반
  if (!storeRow && slot.business_name) {
    storeRow = await findCombinedStoreByName(slot.business_name);
    if (storeRow) resolvedType = "store";
  }

  if (!storeRow && slot.business_name) {
    storeRow = await findFoodStoreByName(slot.business_name);
    if (storeRow) resolvedType = "food";
  }

  // store_id 보강
  if (storeRow?.id && !slot.store_id) {
    slot.store_id = Number(storeRow.id);
  }

  // image_url 보강
  if (!slot.image_url) {
    const picked = pickStoreImage(storeRow);
    if (picked) slot.image_url = picked;
  }

  // link_url 보강
  if (!slot.link_url && storeRow?.id) {
    slot.link_url = `/ndetail.html?id=${storeRow.id}&type=${resolvedType}`;
  }

  // 마지막 보강: bizNo로 대표 이미지 조회
  if (!slot.image_url && slot.business_no) {
    const rep = await getRepImageByBizNo(slot.business_no);
    if (rep) slot.image_url = rep;
  }

  return slot;
}

/* ============================================================
 * 🔸 인덱스 광고 슬롯 업로드
 * POST /manager/ad/upload
 * ============================================================ */
export async function uploadIndexAd(req, res) {
  try {
    const {
      page,
      position,
      slotType,
      slotMode,
      linkUrl,
      textContent,
      storeId,
      businessNo,
      businessName,
      startDate,
      endDate,
      noEnd,
    } = pickBody(req);

    ensurePagePosition(page, position);

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const slot_type = slotType === "text" ? "text" : "banner";
    const slot_mode = slotMode || "custom";
    const store_id =
      storeId && String(storeId).trim() !== "" ? Number(storeId) : null;
    const finalEndDate = noEnd ? null : endDate || null;

    const sql = `
      INSERT INTO admin_ad_slots (
        page, position, slot_type, image_url, link_url, text_content,
        slot_mode, store_id, business_no, business_name, start_date, end_date
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = EXCLUDED.slot_type,
        -- ✅ 파일 없으면 기존 이미지 유지
        image_url = COALESCE(EXCLUDED.image_url, admin_ad_slots.image_url),
        -- ✅ 링크/텍스트도 빈값 덮어쓰기 방지(안전형)
        link_url = COALESCE(EXCLUDED.link_url, admin_ad_slots.link_url),
        text_content = COALESCE(EXCLUDED.text_content, admin_ad_slots.text_content),
        slot_mode = EXCLUDED.slot_mode,
        store_id = EXCLUDED.store_id,
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        updated_at = now()
      RETURNING *;
    `;

    const params = [
      page,
      position,
      slot_type,
      imageUrl,
      linkUrl || null,
      textContent || null,
      slot_mode,
      store_id,
      businessNo || null,
      businessName || null,
      startDate || null,
      finalEndDate,
    ];

    const { rows } = await pool.query(sql, params);

    return res.json({
      ok: true,
      slot: { ...rows[0], page, position },
    });
  } catch (err) {
    console.error("UPLOAD INDEX AD ERROR:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      ok: false,
      message: err.message || "slot 저장 오류",
      code: "INDEX_AD_SAVE_ERROR",
    });
  }
}

/* ============================================================
 * 🔸 등록된 가게로 슬롯 연결
 * POST /manager/ad/store
 * ============================================================ */
export async function saveIndexStoreAd(req, res) {
  try {
    const {
      page,
      position,
      businessNo,
      businessName,
      startDate,
      endDate,
      noEnd,
    } = pickBody(req);

    ensurePagePosition(page, position);

    if (!businessNo || !businessName) {
      return res.status(400).json({
        ok: false,
        message: "사업자번호와 상호명을 모두 입력해야 합니다.",
      });
    }

    const cleanBizNo = String(businessNo).replace(/[^0-9]/g, "").trim();
    const finalEndDate = noEnd ? null : endDate || null;

    const storeId = await findStoreIdByBizAndName(cleanBizNo, businessName);

    const upsertSql = `
      INSERT INTO admin_ad_slots (
        page, position, slot_type, slot_mode,
        business_no, business_name, store_id,
        start_date, end_date, updated_at
      ) VALUES (
        $1,$2,'banner','store',$3,$4,$5,$6,$7,NOW()
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type   = 'banner',
        slot_mode   = 'store',
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        store_id    = EXCLUDED.store_id,
        start_date  = EXCLUDED.start_date,
        end_date    = EXCLUDED.end_date,
        updated_at  = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(upsertSql, [
      page,
      position,
      cleanBizNo,
      businessName,
      storeId,
      startDate || null,
      finalEndDate,
    ]);

    const saved = rows[0];

    // 저장 직후 이미지/링크 보강
    const enriched = await resolveStoreModeSlot({ ...saved });

    let patched = false;

    if (
      (enriched.image_url && enriched.image_url !== saved.image_url) ||
      (enriched.link_url && enriched.link_url !== saved.link_url)
    ) {
      await pool.query(
        `UPDATE admin_ad_slots
           SET image_url = COALESCE($1, image_url),
               link_url  = COALESCE($2, link_url),
               updated_at = NOW()
         WHERE page = $3 AND position = $4`,
        [enriched.image_url || null, enriched.link_url || null, page, position]
      );

      saved.image_url = enriched.image_url || saved.image_url;
      saved.link_url = enriched.link_url || saved.link_url;
      patched = true;
    }

    // 그래도 이미지 없으면 bizNo 기반 최종 보강
    if (!saved.image_url && cleanBizNo) {
      const rep = await getRepImageByBizNo(cleanBizNo);
      if (rep) {
        await pool.query(
          `UPDATE admin_ad_slots
             SET image_url = $1, updated_at = NOW()
           WHERE page = $2 AND position = $3`,
          [rep, page, position]
        );
        saved.image_url = rep;
        patched = true;
      }
    }

    return res.json({
      ok: true,
      slot: { ...saved, page, position, patched },
      storeConnected: !!storeId,
    });
  } catch (err) {
    console.error("SAVE INDEX STORE AD ERROR:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      ok: false,
      message: err.message || "slot 저장 오류",
      code: "INDEX_STORE_AD_SAVE_ERROR",
    });
  }
}

/* ============================================================
 * ✅ 가게와 슬롯 연결 (별도 엔드포인트)
 * POST /manager/ad/store/connect
 * ============================================================ */
export async function connectStoreToSlot(req, res) {
  try {
    // ✅ pickBody로 통일 (프론트 키 혼용 방어)
    const {
      page,
      position,
      businessNo,
      businessName,
      startDate,
      endDate,
      noEnd,
    } = pickBody(req);

    ensurePagePosition(page, position);

    if (!businessNo || !businessName) {
      return res.status(400).json({
        ok: false,
        message: "사업자번호와 상호명을 모두 입력해야 합니다.",
      });
    }

    const cleanBizNo = String(businessNo).replace(/[^0-9]/g, "").trim();
    const finalEndDate = noEnd ? null : endDate || null;

    const storeId = await findStoreIdByBizAndName(cleanBizNo, businessName);

    const sql = `
      INSERT INTO admin_ad_slots (
        page, position, slot_type, slot_mode, business_no, business_name,
        store_id, start_date, end_date, updated_at
      )
      VALUES ($1, $2, 'banner', 'store', $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = 'banner',
        slot_mode = 'store',
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        store_id = EXCLUDED.store_id,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      page,
      position,
      cleanBizNo,
      businessName,
      storeId,
      startDate || null,
      finalEndDate,
    ]);

    const saved = rows[0];

    const enriched = await resolveStoreModeSlot({
      ...saved,
      business_no: cleanBizNo,
      business_name: businessName,
      slot_mode: "store",
      store_id: storeId ?? saved.store_id,
    });

    let patched = false;

    if (
      (enriched.image_url && enriched.image_url !== saved.image_url) ||
      (enriched.link_url && enriched.link_url !== saved.link_url)
    ) {
      await pool.query(
        `UPDATE admin_ad_slots
           SET image_url = COALESCE($1, image_url),
               link_url  = COALESCE($2, link_url),
               updated_at = NOW()
         WHERE page = $3 AND position = $4`,
        [enriched.image_url || null, enriched.link_url || null, page, position]
      );

      saved.image_url = enriched.image_url || saved.image_url;
      saved.link_url = enriched.link_url || saved.link_url;
      patched = true;
    }

    if (!saved.image_url && cleanBizNo) {
      const rep = await getRepImageByBizNo(cleanBizNo);
      if (rep) {
        await pool.query(
          `UPDATE admin_ad_slots
             SET image_url = $1, updated_at = NOW()
           WHERE page = $2 AND position = $3`,
          [rep, page, position]
        );
        saved.image_url = rep;
        patched = true;
      }
    }

    return res.json({
      ok: true,
      slot: { ...saved, patched },
      storeConnected: !!storeId,
    });
  } catch (err) {
    console.error("CONNECT STORE TO SLOT ERROR:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      ok: false,
      message: err.message || "가게 연결 실패",
      code: "STORE_CONNECT_ERROR",
    });
  }
}

/* ============================================================
 * 🔹 인덱스 광고 슬롯 조회
 * GET /manager/ad/slot?page=index&position=best_pick_1
 * ============================================================ */
export async function getIndexSlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.status(400).json({
        success: false,
        error: "page와 position이 필요합니다.",
      });
    }

    const result = await pool.query(
      `SELECT * FROM admin_ad_slots WHERE page = $1 AND position = $2 LIMIT 1`,
      [page, position]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, slot: null, page, position });
    }

    const rawSlot = result.rows[0];
    const slot = await resolveStoreModeSlot({ ...rawSlot });

    return res.json({
      success: true,
      slot: {
        page,
        position,
        image_url: slot.image_url || null,
        link_url: slot.link_url || null,
        business_name: slot.business_name || null,
        business_no: slot.business_no || null,
        slot_type: slot.slot_type || null,
        slot_mode: slot.slot_mode || null,
      },
    });
  } catch (error) {
    console.error(`❌ 슬롯 조회 오류 (${req.query.position}):`, error);
    return res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다.",
    });
  }
}

/* ============================================================
 * 🔹 텍스트 슬롯 조회
 * GET /manager/ad/text/get?page=index&position=xxx
 * ============================================================ */
export async function getIndexTextSlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page, position이 필요합니다.",
      });
    }

    const sql = `
      SELECT id, page, position, slot_type, text_content, start_date, end_date, updated_at
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2 AND slot_type = 'text'
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position]);

    if (rows.length === 0) {
      return res.json({ ok: true, slot: null });
    }

    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("GET INDEX TEXT SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 슬롯 조회 오류",
      code: "INDEX_TEXT_LOAD_ERROR",
    });
  }
}

/* ============================================================
 * 🔹 텍스트 슬롯 저장
 * POST /manager/ad/text/save
 * ============================================================ */
export async function saveIndexTextSlot(req, res) {
  try {
    const { page, position, content } = req.body || {};

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page와 position은 필수입니다.",
      });
    }

    if (!content || String(content).trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "텍스트 내용을 입력해주세요.",
      });
    }

    const sql = `
      INSERT INTO admin_ad_slots (page, position, slot_type, text_content, updated_at)
      VALUES ($1, $2, 'text', $3, NOW())
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = 'text',
        text_content = EXCLUDED.text_content,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [page, position, String(content).trim()]);

    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("SAVE TEXT SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 저장 실패",
      error: err.message,
    });
  }
}

/* ============================================================
 * ✅ Best Pick 슬롯 목록 조회
 * GET /manager/ad/best-pick
 * ============================================================ */
export async function getBestPickSlots(req, res) {
  try {
    const adSlotsQuery = `
      SELECT 
        page, position, image_url, link_url,
        business_name, business_no, slot_mode, store_id
      FROM admin_ad_slots
      WHERE page = 'index'
        AND position LIKE 'best_pick_%'
        AND (
          NULLIF(TRIM(COALESCE(image_url,'')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(business_name,'')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(link_url,'')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(slot_mode,'')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(business_no::text,'')), '') IS NOT NULL
        )
      ORDER BY CAST(SUBSTRING(position FROM 'best_pick_([0-9]+)') AS INTEGER) ASC
    `;

    const { rows } = await pool.query(adSlotsQuery);

    const resolvedRows = [];
    for (const r of rows) {
      if (r.slot_mode === "store") {
        const resolved = await resolveStoreModeSlot({ ...r });
        resolvedRows.push(resolved);
      } else {
        resolvedRows.push(r);
      }
    }

    const slots = resolvedRows.map((slot) => {
      const match = String(slot.position).match(/best_pick_(\d+)/);
      const slotNumber = match ? parseInt(match[1], 10) : 999;

      return {
        id: slotNumber,
        name: slot.business_name || `Best Pick ${slotNumber}`,
        bizNo: slot.business_no || null,
        category: "광고",
        image: slot.image_url || "",
        link: slot.link_url || "",
        type: "ad",
        slotNumber,
      };
    });

    return res.json(slots);
  } catch (err) {
    console.error("BEST PICK ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Best Pick 조회 실패",
    });
  }
}

/* ============================================================
 * ✅ 사업자번호 기반 가게 검색
 * GET /manager/ad/store/search?bizNo=1234567890
 * ============================================================ */
export async function searchStoreByBiz(req, res) {
  try {
    const { bizNo } = req.query;
    if (!bizNo || String(bizNo).trim() === "") {
      return res.status(400).json({ ok: false, message: "사업자번호를 입력해주세요." });
    }

    const cleanBizNo = String(bizNo).replace(/[^0-9]/g, "").trim();

    const { where: whereFood, col: foodCol } = await buildBizNoWhere("food_stores");
    const { where: whereCombined, col: combinedCol } =
      await buildBizNoWhere("combined_store_info");

    const blocks = [];

    if (foodCol) {
      blocks.push(`
        SELECT id, business_name, ${foodCol} AS business_no, 'food' AS store_type
        FROM food_stores
        WHERE ${whereFood}
      `);
    }

    if (combinedCol) {
      blocks.push(`
        SELECT id, business_name, ${combinedCol} AS business_no, 'store' AS store_type
        FROM combined_store_info
        WHERE ${whereCombined}
      `);
    }

    if (blocks.length === 0) {
      return res.json({ ok: true, stores: [] });
    }

    const sql = blocks.join(" UNION ALL ") + " ORDER BY id DESC LIMIT 5";
    const { rows } = await pool.query(sql, [cleanBizNo]);

    return res.json({ ok: true, stores: rows });
  } catch (err) {
    console.error("SEARCH STORE BY BIZ ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "가게 검색 실패",
      code: "STORE_SEARCH_ERROR",
    });
  }
}

/* ============================================================
 * ✅ 슬롯 삭제
 * DELETE /manager/ad/slot?page=index&position=best_pick_1
 * ============================================================ */
export async function deleteSlot(req, res) {
  try {
    const { page, position } = req.query;

    ensurePagePosition(page, position);

    const result = await pool.query(
      `DELETE FROM admin_ad_slots WHERE page = $1 AND position = $2 RETURNING *`,
      [page, position]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "삭제할 슬롯을 찾을 수 없습니다.",
      });
    }

    return res.json({
      ok: true,
      message: "슬롯이 삭제되었습니다.",
      deletedSlot: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE SLOT ERROR:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      ok: false,
      message: err.message || "슬롯 삭제 실패",
      code: "SLOT_DELETE_ERROR",
    });
  }
}
