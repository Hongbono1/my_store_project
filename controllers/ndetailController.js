// controllers/ndetailController.js
import { pool } from "../db.js";

// ───────────────────────────────────────────────────────────
// 배달 여부 검증
const ALLOWED_DELIVERY = new Set(["가능", "불가", "일부 가능"]);
function normalizeDeliveryOption(input) {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (ALLOWED_DELIVERY.has(v)) return v;

  const low = v.toLowerCase();
  if (["y","yes","true","delivery","deliver","배달가능"].includes(low)) return "가능";
  if (["n","no","false","pickup only","픽업","배달불가","불가능"].includes(low)) return "불가";
  return null;
}
// ───────────────────────────────────────────────────────────

// 등록 (병합본: owner_* 포함 + 폼 호환 + 주소/배달 검증)
export async function createStore(req, res) {
  try {
    const b = req.body;

    // 1) 배달 여부 필수
    const deliveryOption = normalizeDeliveryOption(b.deliveryOption);
    if (!deliveryOption) {
      return res.status(400).json({
        ok: false,
        message: "배달 여부는 '가능', '불가', '일부 가능' 중 하나를 선택해야 합니다."
      });
    }

    // 2) 소유자/대표자 정보 (DB 제약 대응: owner_name NOT NULL)
    //    - 폼에 값이 없을 수도 있어서 안전하게 기본값을 둠
    const ownerName  = (b.ownerName ?? b.owner_name ?? b.owner ?? "").trim() || "미기입";
    const birthDate  = b.birthDate  ?? b.birth_date ?? null;
    const ownerEmail = b.ownerEmail ?? b.owner_email ?? null;
    const ownerPhone = b.ownerPhone ?? b.owner_phone ?? null;

    // 3) 가게 기본 정보 (서로 다른 폼 키 호환)
    const businessName        = b.businessName ?? b.storeName ?? null;
    const businessType        = b.businessType ?? b.storeType ?? null;
    const businessSubcategory = b.businessSubcategory ?? b.subCategory ?? b.businessCategory ?? null;
    const businessHours       = b.businessHours ?? null;
    const serviceDetails      = b.serviceDetails ?? null;

    // 4) 주소 (register/owner 양쪽 키 호환)
    const roadAddress   = b.roadAddress ?? b.ownerAddress ?? "";
    const detailAddress = b.detailAddress ?? b.ownerAddressDetail ?? "";
    const address       = (roadAddress || detailAddress) ? `${roadAddress} ${detailAddress}`.trim() : null;

    // 5) 부가 정보
    const event1 = b.event1 ?? null;
    const event2 = b.event2 ?? null;
    const facility = b.facility ?? null;
    const pets = b.pets ?? null;
    const parking = b.parking ?? null;
    const phoneNumber = b.phoneNumber ?? null;
    const homepage = b.homepage ?? null;
    const instagram = b.instagram ?? null;
    const facebook = b.facebook ?? null;
    const additionalDesc = b.additionalDesc ?? null;

    // 6) 이미지/증빙 (추후 multer 연동)
    const image1 = null, image2 = null, image3 = null;
    const businessCertPath = null;

    // 7) INSERT (owner_* 포함 / business_subcategory 사용)
    const sql = `
      INSERT INTO store_info (
        owner_name, birth_date, owner_email, owner_phone,
        business_name, business_type, business_subcategory, business_hours,
        service_details, address, event1, event2, facility, pets, parking,
        phone_number, homepage, instagram, facebook, additional_desc,
        image1, image2, image3, business_cert_path, delivery_option
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25
      )
      RETURNING id
    `;

    const params = [
      ownerName, birthDate, ownerEmail, ownerPhone,
      businessName, businessType, businessSubcategory, businessHours,
      serviceDetails, address, event1, event2, facility, pets, parking,
      phoneNumber, homepage, instagram, facebook, additionalDesc,
      image1, image2, image3, businessCertPath, deliveryOption
    ];

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, storeId: rows[0]?.id ?? null });
  } catch (e) {
    console.error("[createStore] error:", e);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
}
