// controllers/indexmanagerAdController.js
import pool from "../db.js";
import multer from "multer";
import fs from "fs";
import path from "path";

/**
 * ✅ 업로드 폴더 (관리자 index 광고 전용)
 * - 기본은 public/uploads/indexads
 * - Express에서 /uploads 정적서빙을 이미 쓰고 있다는 전제에 가장 안전한 경로
 */
const UPLOAD_SUBDIR = "indexads";
const UPLOAD_ROOT = "/data/uploads";
const UPLOAD_DIR = path.join(UPLOAD_ROOT, UPLOAD_SUBDIR);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });


/**
 * ✅ multer 설정
 * - indexmanager.html은 FormData로
 *   image 또는 slotImage 키로 파일을 보낼 수 있음
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safe =
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8);
    cb(null, `${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * ✅ 라우터에서 그대로 사용
 */
export const uploadSlotImage = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
]);

/**
 * ✅ 바디 키를 프론트/서버 혼용 케이스까지 안전 매핑
 * - indexmanager.html의 새 모달과 기존 코드 혼재를 전부 수용
 */
function pickBody(req) {
  const b = req?.body || {};

  return {
    // 필수 키
    page: b.page,
    position: b.position,

    // 타입/모드
    slotType: b.slotType || b.slot_type || "banner",
    slotMode: b.slotMode || b.slot_mode || "image",

    // 링크
    linkUrl: b.linkUrl || b.link_url || b.link || "",

    // 가게 연결
    storeId: b.storeId || b.store_id || "",
    businessNo: b.businessNo || b.business_no || b.bizNo || "",
    businessName: b.businessName || b.business_name || "",

    // 기간
    startAt:
      b.startAt ||
      b.start_at ||
      b.startDate ||
      b.start_date ||
      "",
    endAt:
      b.endAt ||
      b.end_at ||
      b.endDate ||
      b.end_date ||
      "",

    // 종료없음
    noEnd:
      b.noEnd === "1" ||
      b.no_end === "1" ||
      b.noEnd === true ||
      b.no_end === true,
  };
}

/**
 * ✅ 업로드된 파일에서 이미지 뽑기
 */
function pickUploadedImage(req) {
  const f1 = req?.files?.image?.[0];
  const f2 = req?.files?.slotImage?.[0];
  const file = f1 || f2 || null;
  if (!file) return "";

  // 클라이언트가 접근할 URL
  return `/uploads/${UPLOAD_SUBDIR}/${file.filename}`;
}

/**
 * ✅ 공통 응답 헬퍼
 */
function ok(res, payload = {}) {
  return res.json({ ok: true, success: true, ...payload });
}
function fail(res, status = 400, message = "요청 실패", extra = {}) {
  return res.status(status).json({ ok: false, success: false, message, ...extra });
}

/**
 * ============================================================
 * ✅ 1) 슬롯 단건 조회
 * GET /manager/ad/slot?page=index&position=index_promo_1
 * ============================================================
 *
 * 전제 테이블:
 *  - admin_ad_slots
 *  - UNIQUE(page, position)
 *
 * 컬럼 예상:
 *  page, position, slot_type, slot_mode,
 *  image_url, link_url,
 *  store_id, business_name, business_no,
 *  start_at, end_at,
 *  created_at, updated_at
 */
export const getSlot = async (req, res) => {
  const page = String(req.query.page || "").trim();
  const position = String(req.query.position || "").trim();

  if (!page || !position) {
    return fail(res, 400, "page와 position이 필요합니다.");
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM admin_ad_slots
        WHERE page = $1 AND position = $2
        LIMIT 1
      `,
      [page, position]
    );

    if (!rows[0]) {
      return fail(res, 404, "슬롯 데이터가 없습니다.");
    }

    return ok(res, { slot: rows[0] });
  } catch (err) {
    console.error("[indexmanager] getSlot error:", err);
    return fail(res, 500, "슬롯 조회 중 오류");
  }
};

/**
 * ============================================================
 * ✅ 2) 슬롯 저장(이미지/가게연결 통합)
 * POST /manager/ad/slot
 * ============================================================
 *
 * - indexmanager.html 모달 저장 버튼의 FormData를 그대로 수용
 * - 이미지가 없으면 기존 이미지 유지(업데이트 시 image_url을 덮어쓰지 않도록)
 */
export const upsertSlot = async (req, res) => {
  const body = pickBody(req);

  const page = String(body.page || "").trim();
  const position = String(body.position || "").trim();

  if (!page || !position) {
    return fail(res, 400, "page와 position이 필요합니다.");
  }

  const slotType = String(body.slotType || "banner").trim();
  const slotMode = String(body.slotMode || "image").trim();

  const linkUrl = String(body.linkUrl || "").trim();

  const storeId = String(body.storeId || "").trim();
  const businessNo = String(body.businessNo || "").trim();
  const businessName = String(body.businessName || "").trim();

  const startAtRaw = String(body.startAt || "").trim();
  const endAtRaw = String(body.endAt || "").trim();

  const noEnd = !!body.noEnd;

  // ✅ 업로드 이미지 URL (없으면 "")
  const uploadedImageUrl = pickUploadedImage(req);

  // ✅ 기간 처리
  const startAt = startAtRaw ? new Date(startAtRaw) : null;
  const endAt = noEnd ? null : (endAtRaw ? new Date(endAtRaw) : null);

  // 날짜 파싱 안정성
  if (startAtRaw && (!startAt || isNaN(startAt.getTime()))) {
    return fail(res, 400, "시작 일시 형식이 올바르지 않습니다.");
  }
  if (endAtRaw && (!noEnd) && (!endAt || isNaN(endAt.getTime()))) {
    return fail(res, 400, "종료 일시 형식이 올바르지 않습니다.");
  }

  try {
    /**
     * ✅ 핵심 전략
     * 1) 먼저 기존 슬롯 조회
     * 2) 업로드 이미지가 없으면 기존 image_url 유지
     */
    const prev = await pool.query(
      `
        SELECT image_url
        FROM admin_ad_slots
        WHERE page = $1 AND position = $2
        LIMIT 1
      `,
      [page, position]
    );

    const prevImageUrl = prev.rows?.[0]?.image_url || "";
    const finalImageUrl = uploadedImageUrl || prevImageUrl || "";

    /**
     * ✅ UPSERT
     * - (page, position) unique가 있다고 가정
     */
    const { rows } = await pool.query(
      `
        INSERT INTO admin_ad_slots (
          page, position,
          slot_type, slot_mode,
          image_url, link_url,
          store_id, business_name, business_no,
          start_at, end_at,
          updated_at
        ) VALUES (
          $1, $2,
          $3, $4,
          $5, $6,
          $7, $8, $9,
          $10, $11,
          NOW()
        )
        ON CONFLICT (page, position)
        DO UPDATE SET
          slot_type = EXCLUDED.slot_type,
          slot_mode = EXCLUDED.slot_mode,
          image_url = EXCLUDED.image_url,
          link_url = EXCLUDED.link_url,
          store_id = EXCLUDED.store_id,
          business_name = EXCLUDED.business_name,
          business_no = EXCLUDED.business_no,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          updated_at = NOW()
        RETURNING *
      `,
      [
        page, position,
        slotType, slotMode,
        finalImageUrl, linkUrl,
        storeId || null,
        businessName || null,
        businessNo || null,
        startAt,
        endAt,
      ]
    );

    return ok(res, { slot: rows[0] });
  } catch (err) {
    console.error("[indexmanager] upsertSlot error:", err);
    return fail(res, 500, "슬롯 저장 중 오류");
  }
};

/**
 * ============================================================
 * ✅ 3) 가게 검색
 * GET /manager/ad/store/search?bizNo=...&name=...
 * ============================================================
 *
 * - indexmanager.html 가게 연결 모달에서 사용
 * - 통합 뷰/테이블로 "combined_store_info"를 우선 가정
 */
export const searchStores = async (req, res) => {
  const bizNo = String(req.query.bizNo || req.query.businessNo || "").trim();
  const name = String(req.query.name || req.query.businessName || "").trim();

  if (!bizNo && !name) {
    return fail(res, 400, "bizNo 또는 name이 필요합니다.");
  }

  try {
    // ✅ 조건 동적 구성
    const conds = [];
    const values = [];
    let i = 1;

    if (bizNo) {
      conds.push(`business_no = $${i++}`);
      values.push(bizNo);
    }

    if (name) {
      conds.push(`business_name ILIKE $${i++}`);
      values.push(`%${name}%`);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
        SELECT
          id,
          business_name,
          business_no,
          business_category
        FROM combined_store_info
        ${where}
        ORDER BY id DESC
        LIMIT 20
      `,
      values
    );

    return ok(res, { stores: rows });
  } catch (err) {
    console.error("[indexmanager] searchStores error:", err);

    /**
     * ✅ 만약 combined_store_info가 환경에 없다면
     * - 기존 운영 DB에 맞춰 테이블명만 바꿔서 쓰면 됨
     *   (예: store_info / food_store_info 등)
     */
    return fail(res, 500, "가게 검색 중 오류");
  }
};
