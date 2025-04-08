require("dotenv").config();

const express = require("express");
const path = require("path");
const multer = require("multer");
const { db } = require("./db"); // PostgreSQL용 db.js 파일

const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 경로
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// JSON & 폼 데이터 파싱
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 파일 업로드 설정
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

// 🔄 테스트용 라우터
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
    businessName,
    businessType,
    deliveryOption,
    businessHours,
    serviceDetails,
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
    postalCode,
    roadAddress,
    detailAddress,
  } = req.body;

  try {
    // 병원 정보 저장
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
        businessName,
        businessType,
        deliveryOption === "true",
        businessHours,
        serviceDetails,
        event1,
        event2,
        facility,
        pets === "true",
        parking === "true",
        phoneNumber,
        homepage,
        instagram,
        facebook,
        additionalDesc,
        postalCode,
        roadAddress,
        detailAddress,
      ]
    );

    const hospitalId = infoResult.rows[0].id;

    // 메뉴 정보 저장
    const menuNames = req.body["menuName[]"];
    const menuPrices = req.body["menuPrice[]"];
    const menuImageFiles = req.files["menuImage[]"];

    const safeNames = Array.isArray(menuNames) ? menuNames : menuNames ? [menuNames] : [];
    const safePrices = Array.isArray(menuPrices) ? menuPrices : menuPrices ? [menuPrices] : [];

    for (let i = 0; i < safeNames.length; i++) {
      const name = safeNames[i];
      const price = safePrices[i] || 0;
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
        [hospitalId, name, price, imagePath]
      );
    }

    res.json({ success: true, message: "✅ 병원 정보 + 메뉴 저장 완료!" });
  } catch (err) {
    console.error("❌ 저장 실패:", err);
    res.status(500).json({ error: "DB 저장 실패" });
  }
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 Cloudtype 서버 실행 중: https://www.hongbono1.com`);
});
