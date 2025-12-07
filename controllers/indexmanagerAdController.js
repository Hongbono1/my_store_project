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

    // 가게 연결용
    storeId: b.storeId || b.store_id,
    businessNo: b.businessNo || b.business_no || b.biz_number || b.bizNo,
    businessName: b.businessName || b.business_name || b.biz_name,

    // 기간
    startDate: b.startDate || b.start_date || null,
    endDate: b.endDate || b.end_date || null,
    noEnd: b.noEnd || b.no_end || false,
  };
}

/* ============================================================
 * ✅ A안 핵심 유틸
 * - slot_mode === "store" 이면
 *   business_name / store_id 기반으로 가게를 찾아
 *   image_url, link_url을 서버에서 보강
 * ============================================================ */

/**
 * 다양한 컬럼/형태를 고려해 대표 이미지 후보를 뽑아주는 방어형 함수
 */
function pickStoreImage(storeRow) {
  if (!storeRow) return "";

  const candidates = [
    // 흔한 단일 대표 이미지 케이스
    "image_url",
    "thumbnail_url",
    "thumb_url",
    "main_image_url",
    "banner_image_url",
    "main_img",
    "main_image",

    // 예전/다른 모듈 호환
    "image1",
    "img1",
  ];

  for (const key of candidates) {
    const v = storeRow[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  // 배열 형태 후보
  const images = storeRow.images;
  if (Array.isArray(images) && images[0]) return String(images[0]);

  // 문자열 JSON 배열 후보
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
  } catch (e) {
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
  } catch (e) {
    return null;
  }
}

/**
 * (있어도 되고 없어도 됨) 통합 테이블 후보
 * - 테이블이 없거나 컬럼이 다르면 자동 무시
 */
async function findCombinedStoreByName(name) {
  try {
    const { rows } = await pool.query(
      `SELECT * 
         FROM combined_store_info 
        WHERE business_name = $1 
        ORDER BY created_at DESC NULLS LAST 
        LIMIT 1`,
      [name]
    );
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * store 모드 슬롯 해석기
 * - slot 자체를 mutate해서 image_url/link_url/store_id 보강
 */
async function resolveStoreModeSlot(slot) {
  if (!slot || slot.slot_mode !== "store") return slot;

  let storeRow = null;
  let resolvedType = "food";

  // 1) store_id 우선
  if (slot.store_id) {
    storeRow = await findFoodStoreById(slot.store_id);
  }

  // 2) business_name 기반 food_stores
  if (!storeRow && slot.business_name) {
    storeRow = await findFoodStoreByName(slot.business_name);
  }

  // 3) (선택) 통합 테이블 후보
  if (!storeRow && slot.business_name) {
    const combined = await findCombinedStoreByName(slot.business_name);
    if (combined) {
      storeRow = combined;
      resolvedType = "store";
    }
  }

  // store_id 보강
  if (storeRow?.id && !slot.store_id) {
    slot.store_id = storeRow.id;
  }

  // image_url 보강
  if (!slot.image_url) {
    const picked = pickStoreImage(storeRow);
    if (picked) slot.image_url = picked;
  }

  // link_url 보강
  if (!slot.link_url && storeRow?.id) {
    slot.link_url =
      `/ndetail.html?id=${storeRow.id}&type=${resolvedType === "food" ? "food" : "store"}`;
  }

  return slot;
}

/* ============================================================
 * 🔸 인덱스 광고 슬롯 업로드
 * POST /manager/ad/upload
 * - multipart/form-data
 * - file: image
 * - fields: page, position, link_url, (start_date/end_date...), slotType?, slotMode?
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

/* ============================================================
 * 🔸 등록된 가게(사업자번호 + 상호)로 슬롯 연결
 * POST /manager/ad/store
 * - JSON: { page, position, biz_number, biz_name, start_date, end_date, no_end }
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

    const finalEndDate = noEnd ? null : (endDate || null);

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
        slot_type     = 'banner',
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

/* ============================================================
 * 🔹 인덱스 광고 슬롯 조회
 * GET /manager/ad/slot?page=index&position=index_main_top
 * ✅ A안 반영: store 모드면 서버에서 image/link 보강
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
      `SELECT * 
         FROM admin_ad_slots 
        WHERE page = $1 AND position = $2
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1`,
      [page, position]
    );

    console.log(`📊 DB 조회 결과 (${position}):`, result.rows);

    if (result.rows.length === 0) {
      console.log(`🟡 슬롯 없음(정상): ${position}`);
      return res.json({
        success: true,
        slot: null,
        page,
        position,
      });
    }

    const slot = result.rows[0];

    const responseData = {
      success: true,
      slot: {
        image_url: slot.image_url || null,
        link_url: slot.link_url || null,
        business_name: slot.business_name || null,
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
 * 🔹 텍스트 슬롯 조회 (admin_ad_slots 기준 통일)
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

/* ============================================================
 * 🔹 텍스트 슬롯 저장 (admin_ad_slots 기준 통일)
 * POST /manager/ad/text/save
 * - JSON: { page, position, content }
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

/* ============================================================
 * ✅ Best Pick 광고 슬롯 목록 조회 (선택 유지용)
 * GET /manager/ad/best-pick
 *
 * - admin_ad_slots만 기준으로 반환
 * - 등록된 슬롯만 내려줌
 * - 프론트가 빈 슬롯은 "준비중" 처리 가능
 * ============================================================ */
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

/* ============================================================
 * ✅ 사업자번호 기반 가게 검색 (자동 후보)
 * GET /manager/ad/store/search?bizNo=1234567890
 *
 * - HTML의 runBizSearch()가 이 API를 이미 호출하고 있음
 * - 컬럼명이 환경마다 다를 수 있어 "안전 2단 조회" 방식
 * ============================================================ */
export async function searchStoreByBiz(req, res) {
  try {
    const { bizNo } = req.query;

    if (!bizNo || String(bizNo).trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "사업자번호를 입력해주세요.",
      });
    }

    const cleanBizNo = String(bizNo).replace(/-/g, "").trim();

    // 1) food_stores 우선 조회
    let storeQuery = `
      SELECT 
        id, 
        business_name,
        business_no,
        'food' as store_type
      FROM food_stores 
      WHERE business_no = $1 
      LIMIT 5
    `;

    let { rows } = await pool.query(storeQuery, [cleanBizNo]);

    // 2) (선택) 통합 테이블도 확인
    if (rows.length === 0) {
      try {
        const combinedQuery = `
          SELECT 
            id, 
            business_name,
            business_no,
            'store' as store_type
          FROM combined_store_info 
          WHERE business_no = $1 
          LIMIT 5
        `;
        const combinedResult = await pool.query(combinedQuery, [cleanBizNo]);
        rows = combinedResult.rows;
      } catch (e) {
        // 통합 테이블이 없어도 괜찮음
      }
    }

    return res.json({
      ok: true,
      stores: rows,
    });
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
 * ✅ 가게와 슬롯 연결 (사업자번호 + 상호명 기반)
 * POST /manager/ad/store/connect
 * - JSON: { page, position, bizNo, bizName, startDate?, endDate?, noEnd? }
 * 
 * - saveIndexStoreAd와 유사하지만 더 범용적
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
    const finalEndDate = noEnd ? null : (endDate || null);

    // 가게 정보 조회 (store_id 자동 매핑)
    let storeId = null;
    try {
      const storeResult = await pool.query(
        `SELECT id FROM food_stores WHERE business_no = $1 LIMIT 1`,
        [cleanBizNo]
      );
      if (storeResult.rows.length > 0) {
        storeId = storeResult.rows[0].id;
      }
    } catch (e) {
      // 가게 매핑 실패해도 슬롯 등록은 진행
      console.warn("가게 ID 매핑 실패:", e.message);
    }

    const sql = `
      INSERT INTO admin_ad_slots (
        page, position,
        slot_type, slot_mode,
        business_no, business_name,
        store_id,
        start_date, end_date,
        updated_at
      )
      VALUES (
        $1, $2,
        'banner', 'store',
        $3, $4,
        $5,
        $6, $7,
        NOW()
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = 'banner',
        slot_mode     = 'store',
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        store_id      = EXCLUDED.store_id,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      page,
      position,
      cleanBizNo,
      bizName,
      storeId,
      startDate || null,
      finalEndDate,
    ]);

    return res.json({ 
      ok: true, 
      slot: rows[0],
      storeConnected: !!storeId
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
      `DELETE FROM admin_ad_slots 
       WHERE page = $1 AND position = $2 
       RETURNING *`,
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

