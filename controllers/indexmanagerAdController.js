// controllers/indexmanagerAdController.js
import pool from "../db.js";

/**
 * 공통: page / position 검증
 */
function ensurePagePosition(page, position) {
  if (!page || !position) {
    const err = new Error("page, position 값이 필요합니다.");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * 바디 키를 프론트/서버 혼용 케이스까지 안전 매핑
 */
function pickBody(req) {
  const b = req.body || {};

  return {
    page: b.page,
    position: b.position,

    // 모드/타입
    slotType: b.slotType || b.slot_type,
    slotMode: b.slotMode || b.slot_mode,

    // 링크
    linkUrl: b.linkUrl || b.link_url || b.link,

    // 텍스트
    textContent: b.textContent || b.text_content || b.content,

    // 가게 연결용(현재는 메타 저장만)
    storeId: b.storeId || b.store_id,
    businessNo: b.businessNo || b.business_no || b.biz_number || b.bizNo,
    businessName: b.businessName || b.business_name || b.biz_name,

    // 기간(현재 컬럼이 없을 수 있어 date만 저장)
    startDate: b.startDate || b.start_date || null,
    endDate: b.endDate || b.end_date || null,
    noEnd: b.noEnd || b.no_end || false,
  };
}

/**
 * ==============================
 * 🔸 인덱스 광고 슬롯 업로드
 * POST /manager/ad/upload
 * - multipart/form-data
 * - file: image
 * - fields: page, position, link_url, (start_date/end_date...), slotType?, slotMode?
 * ==============================
 */
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

    // 파일 업로드 (multer: upload.single("image"))
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // slot_type: banner/text만 허용
    const slot_type = slotType === "text" ? "text" : "banner";

    const slot_mode = slotMode || "custom";

    const store_id =
      storeId && String(storeId).trim() !== ""
        ? Number(storeId)
        : null;

    // 종료 없음 체크 시 end_date는 null로 저장
    const finalEndDate = noEnd ? null : (endDate || null);

    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = EXCLUDED.slot_type,
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        slot_mode     = EXCLUDED.slot_mode,
        store_id      = EXCLUDED.store_id,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = now()
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
      slot: rows[0],
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

/**
 * ==============================
 * 🔸 등록된 가게(사업자번호 + 상호)로 슬롯 연결
 * POST /manager/ad/store
 * - JSON: { page, position, biz_number, biz_name, start_date, end_date, no_end }
 * ==============================
 */
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

    const finalEndDate = noEnd ? null : (endDate || null);

    // store 모드는 일단 메타만 저장
    // 이미지/링크 자동연결은 나중에 구현해도 됨
    const sql = `
      INSERT INTO admin_ad_slots (
        page, position,
        slot_type,
        slot_mode,
        business_no, business_name,
        start_date, end_date
      )
      VALUES (
        $1, $2,
        'banner',
        'store',
        $3, $4,
        $5, $6
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_mode     = 'store',
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      page,
      position,
      businessNo,
      businessName,
      startDate || null,
      finalEndDate,
    ]);

    return res.json({ ok: true, slot: rows[0] });
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

/**
 * ==============================
 * 🔹 인덱스 광고 슬롯 조회
 * GET /manager/ad/slot?page=index&position=index_main_top
 * ==============================
 */
export async function getIndexSlot(req, res) {
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
        id,
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position]);

    if (rows.length === 0) {
      return res.json({ ok: true, slot: null });
    }

    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("GET INDEX SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "슬롯 조회 오류",
      code: "INDEX_AD_LOAD_ERROR",
    });
  }
}

/**
 * ==============================
 * 🔹 텍스트 슬롯 조회 (admin_ad_slots 기준 통일)
 * GET /manager/ad/text/get?page=index&position=index_sub_keywords
 * ==============================
 */
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
      SELECT
        id,
        page,
        position,
        slot_type,
        text_content,
        start_date,
        end_date,
        updated_at
      FROM admin_ad_slots
      WHERE page = $1
        AND position = $2
        AND slot_type = 'text'
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

/**
 * ==============================
 * 🔹 텍스트 슬롯 저장 (admin_ad_slots 기준 통일)
 * POST /manager/ad/text/save
 * - JSON: { page, position, content }
 * ==============================
 */
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
      INSERT INTO admin_ad_slots (
        page, position, slot_type, text_content, updated_at
      )
      VALUES ($1, $2, 'text', $3, NOW())
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = 'text',
        text_content = EXCLUDED.text_content,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      page,
      position,
      String(content).trim(),
    ]);

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("SAVE TEXT SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 저장 실패",
      error: err.message,
    });
  }
}

/**
 * ==============================
 * ✅ Best Pick 광고 슬롯 조회 (관리자 슬롯만)
 * GET /manager/ad/best-pick
 * ==============================
 * - food_stores 등 다른 테이블 의존 제거
 * - 1~18번 중 "등록된 슬롯만" 반환
 * - 빈 상태는 프론트가 더미로 처리
 */
export async function getBestPickSlots(req, res) {
  try {
    const adSlotsQuery = `
      SELECT 
        position,
        image_url,
        link_url,
        business_name,
        slot_mode
      FROM admin_ad_slots
      WHERE page = 'index' 
        AND position LIKE 'best_pick_%'
        AND (
          image_url IS NOT NULL 
          OR business_name IS NOT NULL 
          OR link_url IS NOT NULL
          OR slot_mode IS NOT NULL
        )
      ORDER BY 
        CAST(SUBSTRING(position FROM 'best_pick_([0-9]+)') AS INTEGER) ASC
    `;

    const { rows: adSlots } = await pool.query(adSlotsQuery);

    const slots = adSlots.map((slot) => {
      const match = String(slot.position).match(/best_pick_(\d+)/);
      const slotNumber = match ? parseInt(match[1], 10) : 999;

      return {
        id: slotNumber,
        name: slot.business_name || `Best Pick ${slotNumber}`,
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
