// controllers/indexmanagerAdController.js
import pool from "../db.js";

/**
 * 바디 키를 프론트/서버 혼용 케이스까지 안전 매핑
 * - 업로드/가게연결/텍스트/기간 공통 대응
 */
function pickBody(req) {
  const b = req?.body || {};

  return {
    // 필수 키
    page: b.page,
    position: b.position,

    // 모드/타입
    slotType: b.slotType || b.slot_type,
    slotMode: b.slotMode || b.slot_mode,

    // 링크
    linkUrl: b.linkUrl || b.link_url || b.link,

    // 텍스트
    textContent: b.textContent || b.text_content || b.content,

    // 가게 연결용
    storeId: b.storeId || b.store_id,
    businessNo: b.businessNo || b.business_no || b.biz_number || b.bizNo || b.bizNoRaw,
    businessName: b.businessName || b.business_name || b.biz_name || b.bizName,

    // 기간
    startDate: b.startDate || b.start_date || null,
    endDate: b.endDate || b.end_date || null,
    noEnd: b.noEnd ?? b.no_end ?? false,
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
 * ① 대표 이미지 조회 유틸
 *  - bizNo로 combined_store_info → store_info 순으로 대표 이미지 찾기
 *  - /data/uploads/* → /uploads/* 로 표준화
 * ========================= */
function normalizeUploadPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (!s) return null;
  if (s.startsWith("/data/uploads/")) return s.replace("/data/uploads", "/uploads");
  if (s.startsWith("uploads/")) return "/" + s.replace(/^\/?/, "");
  return s; // 절대 URL은 그대로
}

// ✅ 컬럼 존재 여부 체크
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

// ✅ 테이블별 안전한 ORDER BY 생성
async function buildSafeOrderClause(table) {
  if (await hasColumn(table, "updated_at")) return "updated_at DESC NULLS LAST, id DESC";
  if (await hasColumn(table, "created_at")) return "created_at DESC NULLS LAST, id DESC";
  if (await hasColumn(table, "id")) return "id DESC";
  return "1"; // 최후 fallback
}

// ✅ image 후보 컬럼 탐색
async function findImageColumns(table) {
  const candidates = [
    "main_img", "main_image", "image1", "image2", "image3",
    "image_url", "thumbnail_url", "thumb_url",
    "main_image_url", "banner_image_url",
    "img1", "img2", "img3",
    "photo1", "photo2", "photo3",
    "store_image", "store_main_image",
    "represent_img", "rep_img",
    "images"
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
      ORDER BY column_name`,
    [table, candidates]
  );

  return rows.map(r => r.column_name);
}

// ✅ information_schema로 테이블 내 '사업자번호' 후보 컬럼 탐색
async function findBizNoColumn(table) {
  const candidates = [
    "business_no", "biz_no", "biz_number", "business_number",
    "registration_no", "reg_no", "brn", "corp_no"
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

// ✅ 숫자만 비교하는 WHERE 절 생성 (컬럼 없으면 FALSE)
async function buildBizNoWhere(table) {
  const col = await findBizNoColumn(table);
  if (!col) return { where: "FALSE", col: null };
  const where = `regexp_replace(COALESCE(${col}::text, ''), '[^0-9]', '', 'g') = $1`;
  return { where, col };
}

/* =========================
 * ✅ 대표 이미지 조회 유틸(완전 방어형)
 *  - bizNo로 combined_store_info → store_info → food_stores 순서 탐색
 *  - 존재하는 이미지 컬럼만 대상으로 안전하게 조회
 * ========================= */

// ✅ 대표 이미지 후보를 테이블에서 안전 추출
async function pickRepFromTableByBiz(table, biz) {
  const { where } = await buildBizNoWhere(table);
  if (!where || where === "FALSE") return null;

  const cols = await findImageColumns(table);
  if (!cols.length) return null;

  const hasImages = cols.includes("images");
  const simpleCols = cols.filter(c => c !== "images");
  const orderClause = await buildSafeOrderClause(table);

  // 1) 문자열 컬럼 우선
  if (simpleCols.length) {
    const expr = simpleCols
      .map(c => `NULLIF(TRIM(COALESCE(${c}::text,'')), '')`)
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

    // 2) images fallback
    if (hasImages && row?.images) {
      const raw = row.images;
      if (Array.isArray(raw) && raw[0]) return normalizeUploadPath(String(raw[0]));
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed[0]) {
            return normalizeUploadPath(String(parsed[0]));
          }
        } catch (_) {}
      }
    }
  } else if (hasImages) {
    // images만 있는 케이스
    const sql = `
      SELECT images
      FROM ${table}
      WHERE ${where}
      ORDER BY ${orderClause}
      LIMIT 1
    `;
    const r = await pool.query(sql, [biz]);
    const row = r.rows?.[0];
    const raw = row?.images;

    if (Array.isArray(raw) && raw[0]) return normalizeUploadPath(String(raw[0]));
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed[0]) return normalizeUploadPath(String(parsed[0]));
      } catch (_) {}
    }
  }

  return null;
}

// ✅ [필수] resolveStoreModeSlot이 직접 호출하는 함수
export async function getRepImageByBizNo(bizNoRaw) {
  if (!bizNoRaw) return null;
  const biz = String(bizNoRaw).replace(/[^0-9]/g, "").trim();
  if (!biz) return null;

  const tables = ["combined_store_info", "store_info", "food_stores"];

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

/**
 * 다양한 컬럼/형태를 고려해 대표 이미지 후보를 뽑아주는 방어형 함수
 */
function pickStoreImage(storeRow) {
  if (!storeRow) return "";
  const candidates = [
    "image_url", "thumbnail_url", "thumb_url", "main_image_url", "banner_image_url",
    "main_img", "main_image", "image1", "img1", "photo1", "store_image", "store_main_image"
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
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1`,
      [name]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ✅ combined_store_info by id
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

// ✅ combined_store_info by name
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

// ✅ bizNo + businessName을 함께 써서 "정확히 그 가게"를 찾는 함수
async function findStoreIdByBizAndName(cleanBizNo, businessName) {
  // 1) combined_store_info 우선
  try {
    const { where: whereCombined, col: combinedCol } = await buildBizNoWhere("combined_store_info");
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

  // 3) 이름이 정확히 안 맞는 경우를 대비한 bizNo-only fallback
  try {
    const { where: whereCombined, col: combinedCol } = await buildBizNoWhere("combined_store_info");
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
  } catch {}

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
  } catch {}

  return null;
}

/**
 * store 모드 슬롯 해석기 (강화버전)
 * - slot 객체에 image_url/link_url/store_id 보강
 */
async function resolveStoreModeSlot(slot) {
  if (!slot || slot.slot_mode !== "store") return slot;

  let storeRow = null;
  let resolvedType = "food";

  // 1) store_id 우선
  if (slot.store_id) {
    storeRow = await findFoodStoreById(slot.store_id);

    // ✅ food에서 못 찾으면 combined로
    if (!storeRow) {
      storeRow = await findCombinedStoreById(slot.store_id);
      if (storeRow) resolvedType = "store";
    }
  }

  // 2) business_name 기반
  if (!storeRow && slot.business_name) {
    // ✅ combined 먼저(헤어/뷰티 등)
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

  // 마지막 보강: bizNo 기반 대표이미지
  if (!slot.image_url && (slot.business_no || slot.businessNo)) {
    const rep = await getRepImageByBizNo(slot.business_no || slot.businessNo);
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

    console.log("📤 업로드 파일 정보:", {
      originalname: req.file?.originalname,
      filename: req.file?.filename,
      path: req.file?.path,
      size: req.file?.size,
    });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    console.log("🖼️ 이미지 URL 생성:", imageUrl);

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
        image_url = EXCLUDED.image_url,
        link_url = EXCLUDED.link_url,
        text_content = EXCLUDED.text_content,
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

    console.log("💾 DB 저장 결과:", {
      id: rows[0]?.id,
      image_url: rows[0]?.image_url,
      page: rows[0]?.page,
      position: rows[0]?.position,
    });

    // ✅ 보강: slot 응답에 page/position 포함
    return res.json({
      ok: true,
      slot: {
        ...rows[0],
        page,
        position,
      },
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
 * 🔸 등록된 가게로 슬롯 연결 (기존)
 * POST /manager/ad/store
 * ============================================================ */
export async function saveIndexStoreAd(req, res) {
  try {
    const {
      page, position, businessNo, businessName,
      startDate, endDate, noEnd,
    } = pickBody(req);

    ensurePagePosition(page, position);
    if (!businessNo || !businessName) {
      return res.status(400).json({ ok: false, message: "사업자번호와 상호명을 모두 입력해야 합니다." });
    }

    const cleanBizNo = String(businessNo).replace(/-/g, "").trim();
    const finalEndDate = noEnd ? null : endDate || null;

    // ✅ bizNo + businessName 기반으로 정확 매칭
    let storeId = await findStoreIdByBizAndName(cleanBizNo, businessName);

    // 2) 업서트
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
      page, position, cleanBizNo, businessName, storeId,
      startDate || null, finalEndDate,
    ]);
    const saved = rows[0];

    // 3) 저장 직후 이미지/링크 자동 보강
    const enriched = await resolveStoreModeSlot({ ...saved });
    let patched = false;

    if ((enriched.image_url && enriched.image_url !== saved.image_url) ||
      (enriched.link_url && enriched.link_url !== saved.link_url)) {
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

    // (추가) 여전히 image_url이 없으면 bizNo로 대표 이미지 최종 보강
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
 * 🔹 인덱스 광고 슬롯 조회
 * GET /manager/ad/slot?page=index&position=index_main_top
 * ✅ store 모드면 서버에서 image/link 보강
 * ============================================================ */
export async function getIndexSlot(req, res) {
  try {
    const { page, position } = req.query;

    console.log(`🔍 슬롯 조회 요청: page=${page}, position=${position}`);

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
      console.log(`🟡 슬롯 없음(정상): ${position}`);
      return res.json({ success: true, slot: null, page, position });
    }

    const rawSlot = result.rows[0];
    const slot = await resolveStoreModeSlot({ ...rawSlot });

    // ✅ 보강: 응답 slot 내부에 page/position 포함
    const responseData = {
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
    };

    console.log(`✅ 슬롯 응답 (${position}):`, responseData);
    return res.json(responseData);
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
 * GET /manager/ad/text/get?page=index&position=index_sub_keywords
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
 * ✅ Best Pick 광고 슬롯 목록 조회
 * GET /manager/ad/best-pick
 * ============================================================ */
/* ============================================================
 * ✅ Best Pick 광고 슬롯 목록 조회
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
// ✅ 사업자번호 기반 가게 검색 (수정본)
export async function searchStoreByBiz(req, res) {
  try {
    const { bizNo } = req.query;
    if (!bizNo || String(bizNo).trim() === "") {
      return res.status(400).json({ ok: false, message: "사업자번호를 입력해주세요." });
    }

    // 1) 숫자만 남기기
    const cleanBizNo = String(bizNo).replace(/-/g, "").trim();

    // 2) 실제 존재하는 컬럼 자동 탐색 + 숫자만 비교 WHERE 생성
    const { where: whereFood, col: foodCol } = await buildBizNoWhere("food_stores");
    const { where: whereCombined, col: combinedCol } = await buildBizNoWhere("combined_store_info");

    // 3) 이제 찍어도 안전
    console.log("[DEBUG][searchStoreByBiz]", { foodCol, combinedCol, cleanBizNo });

    // 4) 존재하는 테이블만 UNION ALL 로 묶기
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

    // 5) 둘 다 사업자번호 컬럼이 없으면 빈 배열 반환 (08P01 방지)
    if (blocks.length === 0) {
      return res.json({ ok: true, stores: [] });
    }

    // 6) 단일 파라미터로 실행
    const sql = blocks.join(" UNION ALL ") + " LIMIT 5";
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
 * ✅ 가게와 슬롯 연결 (보강 포함 수정본)
 * POST /manager/ad/store/connect
 * ============================================================ */
export async function connectStoreToSlot(req, res) {
  try {
    const {
      page,
      position,
      bizNo,
      bizName,
      startDate,
      endDate,
      noEnd,
    } = req.body || {};

    ensurePagePosition(page, position);

    if (!bizNo || !bizName) {
      return res.status(400).json({
        ok: false,
        message: "사업자번호(bizNo)와 상호명(bizName)을 모두 입력해야 합니다.",
      });
    }

    const cleanBizNo = String(bizNo).replace(/-/g, "").trim();
    const finalEndDate = noEnd ? null : endDate || null;

    // ✅ bizNo + bizName 기반으로 정확 매칭
    let storeId = await findStoreIdByBizAndName(cleanBizNo, bizName);

    // 2) 업서트
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
      page, position, cleanBizNo, bizName, storeId, startDate || null, finalEndDate,
    ]);

    const saved = rows[0];

    // 3) ✅ 저장 직후 대표이미지/링크 보강
    const enriched = await resolveStoreModeSlot({
      ...saved,
      business_no: cleanBizNo,
      business_name: bizName,
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

    // 4) ✅ 그래도 없으면 bizNo 기반 최종 보강
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
