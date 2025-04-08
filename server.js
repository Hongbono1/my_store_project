require("dotenv").config();

const express = require("express");
const path = require("path");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const db = require("./db"); // PostgreSQL 연결만 사용

// 정적 파일 경로 설정
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// JSON & URL 인코딩 파싱
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer 파일 업로드 설정
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });
const fieldsUpload = upload.fields([
  { name: "images[]", maxCount: 3 },
  { name: "menuImage[]", maxCount: 20 },
]);

// 연결 테스트 라우터
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.send("✅ DB 연결 성공! 현재 시간: " + result.rows[0].now);
  } catch (err) {
    console.error("❌ DB 연결 실패:", err);
    res.status(500).send("DB 연결 실패");
  }
});

// [POST] 병원 정보 + 메뉴 저장
app.post("/store", fieldsUpload, async (req, res) => {
  const {
    businessName, businessType, deliveryOption, businessHours,
    serviceDetails, event1, event2, facility, pets, parking,
    phoneNumber, homepage, instagram, facebook, additionalDesc,
    postalCode, roadAddress, detailAddress,
  } = req.body;

  try {
    const infoResult = await db.query(
      `
      INSERT INTO hospital_info (
        name, category, delivery, open_hours, service_details,
        event1, event2, facility, pets, parking,
        phone, homepage, instagram, facebook, additional_desc,
        postal_code, road_address, detail_address
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18
      )
      RETURNING id
      `,
      [
        businessName, businessType, deliveryOption === "true", businessHours,
        serviceDetails, event1, event2, facility, pets === "true", parking === "true",
        phoneNumber, homepage, instagram, facebook, additionalDesc,
        postalCode, roadAddress, detailAddress
      ]
    );

    const hospitalId = infoResult.rows[0].id;

    const menuNames = req.body["menuName[]"];
    const menuPrices = req.body["menuPrice[]"];
    const menuImageFiles = req.files["menuImage[]"];

    const safeNames = Array.isArray(menuNames) ? menuNames : menuNames ? [menuNames] : [];
    const safePrices = Array.isArray(menuPrices) ? menuPrices : menuPrices ? [menuPrices] : [];

    for (let i = 0; i < safeNames.length; i++) {
      const thisName = safeNames[i];
      const thisPrice = safePrices[i] || 0;
      let imagePath = null;
      if (menuImageFiles && menuImageFiles[i]) {
        imagePath = "/uploads/" + menuImageFiles[i].filename;
      }

      await db.query(
        `
        INSERT INTO hospital_menu (
          hospital_id, menu_name, menu_price, menu_image
        ) VALUES (
          $1, $2, $3, $4
        )
        `,
        [hospitalId, thisName, thisPrice, imagePath]
      );
    }

    res.json({ success: true, message: "✅ 병원 정보 + 메뉴 저장 완료!" });
  } catch (err) {
    console.error("❌ 저장 실패:", err);
    res.status(500).json({ error: "DB 저장 실패" });
  }
});

// [GET] 병원 상세 정보 조회
app.get("/store/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const infoResult = await db.query("SELECT * FROM hospital_info WHERE id = $1", [id]);
    if (infoResult.rows.length === 0) {
      return res.status(404).json({ error: "해당 ID의 병원 정보가 없습니다." });
    }

    const info = infoResult.rows[0];

    const menuResult = await db.query("SELECT * FROM hospital_menu WHERE hospital_id = $1", [id]);

    const data = {
      businessName: info.name,
      businessType: info.category,
      deliveryOption: info.delivery,
      businessHours: info.open_hours,
      serviceDetails: info.service_details,
      event1: info.event1,
      event2: info.event2,
      facility: info.facility,
      pets: info.pets,
      parking: info.parking,
      phoneNumber: info.phone,
      homepage: info.homepage,
      instagram: info.instagram,
      facebook: info.facebook,
      additionalDesc: info.additional_desc,
      images: [],
      postalCode: info.postal_code,
      roadAddress: info.road_address,
      detailAddress: info.detail_address,
      menuItems: menuResult.rows.map((menu) => ({
        menuName: menu.menu_name,
        menuPrice: menu.menu_price,
        menuImageUrl: menu.menu_image,
      }))
    };

    res.json(data);
  } catch (err) {
    console.error("❌ 조회 실패:", err);
    res.status(500).json({ error: "DB 조회 실패" });
  }
});

// 서버 실행
app.listen(PORT, () => {
  console.log("🚀 Cloudtype 서버 실행 중: https://www.hongbono1.com");
});
