// controllers/foodregisterController.js

// POST /foodregister
export async function createFoodRegister(req, res) {
  try {
    // 텍스트 필드
    const form = req.body || {};

    // 파일들
    const storeImages = req.files?.["storeImages"] || [];   // 배열
    const menuImages = req.files?.["menuImage[]"] || [];   // 배열
    const bizCert = (req.files?.["businessCertImage"] || [])[0] || null;

    // TODO: 여기서 DB 저장 (Neon/PostgreSQL)
    //  - store_info, store_images, menu_items 등 스키마에 맞춰 insert
    //  - 파일 경로는 `/uploads/파일명` 형태로 저장 (정적 서빙 경로와 일치)
    //  - form의 키는 foodregister.html의 name 기준으로 1:1 대응

    return res.json({
      ok: true,
      received: {
        formKeys: Object.keys(form),
        storeImages: storeImages.map(f => `/uploads/${pathFromUploads(f)}`),
        menuImages: menuImages.map(f => `/uploads/${pathFromUploads(f)}`),
        businessCertImage: bizCert ? `/uploads/${pathFromUploads(bizCert)}` : null,
      }
    });
  } catch (e) {
    console.error("[createFoodRegister] error:", e);
    return res.status(500).json({ error: "create failed" });
  }
}

// GET /foodregister/:id
export async function getFoodRegisterDetail(req, res) {
  try {
    const { id } = req.params;

    // TODO: DB에서 가게 상세 조회
    // 예시 응답 형태 (프론트 바인딩 참고용)
    return res.json({
      ok: true,
      id,
      businessName: "상호명 예시",
      businessType: "업종 예시",
      businessCategory: "카테고리 예시",
      deliveryOption: "가능/불가",
      businessHours: "10:00 ~ 20:00",
      address: "서울시 어딘가 123",
      images: [
        "/uploads/sample1.jpg",
        "/uploads/sample2.jpg",
      ],
    });
  } catch (e) {
    console.error("[getFoodRegisterDetail] error:", e);
    return res.status(500).json({ error: "detail failed" });
  }
}

// GET /foodregister/:id/menus
export async function getFoodRegisterMenus(req, res) {
  try {
    const { id } = req.params;

    // TODO: DB에서 메뉴 리스트 조회
    return res.json({
      ok: true,
      id,
      menus: [
        { name: "왕돈가스", price: 9000 },
        { name: "치즈돈가스", price: 10000 },
      ]
    });
  } catch (e) {
    console.error("[getFoodRegisterMenus] error:", e);
    return res.status(500).json({ error: "menus failed" });
  }
}

// 내부 유틸: 업로드 상대경로 추출
function pathFromUploads(file) {
  // multer가 저장한 절대경로에서 public2/uploads 이후만 잘라서 사용
  const idx = file.path.indexOf("uploads");
  return idx >= 0 ? file.path.slice(idx + "uploads/".length) : file.filename;
}
