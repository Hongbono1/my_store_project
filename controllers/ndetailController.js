// controllers/ndetailController.js
import { pool } from "../db.js";

// 배달 여부 검증 (필수)
const ALLOWED_DELIVERY = new Set(["가능", "불가", "일부 가능"]);
function normalizeDeliveryOption(input) {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (ALLOWED_DELIVERY.has(v)) return v;

  const low = v.toLowerCase();
  if (["y", "yes", "true", "delivery", "deliver", "배달가능"].includes(low)) return "가능";
  if (["n", "no", "false", "pickup only", "픽업", "배달불가", "불가능"].includes(low)) return "불가";
  return null;
}

// 등록
export async function createStore(req, res) {
  try {
    // multer(any)로 파싱된 body
    const b = req.body;

    // 필수: 배달 여부
    const deliveryOption = normalizeDeliveryOption(b.deliveryOption);
    if (!deliveryOption) {
      return res.status(400).json({
        ok: false,
        message: "배달 여부는 '가능', '불가', '일부 가능' 중 하나를 선택해야 합니다."
      });
    }

    // 필요한 주요 필드 (폼에서 오는 name 기준)
    const businessName = b.businessName ?? null;
    const businessType = b.businessType ?? null;
    const businessSubcategory = b.businessSubcategory ?? null; // DB에 있는 건 이 컬럼만 존재
    const businessHours = b.businessHours ?? null;
    const serviceDetails = b.serviceDetails ?? null;

    // 주소(우편번호/도로명/상세를 합쳐 1개 address에 저장)
    const roadAddress = b.roadAddress ?? "";
    const detailAddress = b.detailAddress ?? "";
    const address = (roadAddress || detailAddress) ? `${roadAddress} ${detailAddress}`.trim() : null;

    // 기타 부가정보
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

    // 이미지/파일 업로드는 추후 연결 (지금은 null 처리)
    const image1 = null, image2 = null, image3 = null;
    const businessCertPath = null;

    // INSERT (존재하는 컬럼만 사용)
    const sql = `
      INSERT INTO store_info (
        business_name,
        business_type,
        business_subcategory,
        business_hours,
        service_details,
        address,
        event1,
        event2,
        facility,
        pets,
        parking,
        phone_number,
        homepage,
        instagram,
        facebook,
        additional_desc,
        image1,
        image2,
        image3,
        business_cert_path,
        delivery_option
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING id
    `;

    const params = [
      businessName,
      businessType,
      businessSubcategory,
      businessHours,
      serviceDetails,
      address,
      event1,
      event2,
      facility,
      pets,
      parking,
      phoneNumber,
      homepage,
      instagram,
      facebook,
      additionalDesc,
      image1,
      image2,
      image3,
      businessCertPath,
      deliveryOption
    ];

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, storeId: rows[0]?.id ?? null });
  } catch (e) {
    console.error("[createStore] error:", e);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
}

// 상세
// ...위 생략...
export async function createStore(req, res) {
  try {
    const b = req.body;

    const deliveryOption = normalizeDeliveryOption(b.deliveryOption);
    if (!deliveryOption) {
      return res.status(400).json({ ok:false, message:"배달 여부는 '가능', '불가', '일부 가능' 중 하나를 선택해야 합니다." });
    }

    // ✨ NOT NULL 회피: owner 필드 포함
    const ownerName  = b.ownerName  ?? null;
    const birthDate  = b.birthDate  ?? null;
    const ownerEmail = b.ownerEmail ?? null;
    const ownerPhone = b.ownerPhone ?? null;

    const businessName        = b.businessName ?? null;
    const businessType        = b.businessType ?? null;
    const businessSubcategory = b.businessSubcategory ?? b.subCategory ?? null;
    const businessHours       = b.businessHours ?? null;
    const serviceDetails      = b.serviceDetails ?? null;

    // 주소(두 폼 호환)
    const roadAddress   = b.roadAddress ?? b.ownerAddress ?? "";
    const detailAddress = b.detailAddress ?? b.ownerAddressDetail ?? "";
    const address       = (roadAddress || detailAddress) ? `${roadAddress} ${detailAddress}`.trim() : null;

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

    const image1 = null, image2 = null, image3 = null;
    const businessCertPath = null;

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
    return res.json({ ok:true, storeId: rows[0]?.id ?? null });
  } catch (e) {
    console.error("[createStore] error:", e);
    return res.status(500).json({ ok:false, message:"서버 오류" });
  }
}
