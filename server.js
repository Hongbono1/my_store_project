// 📁 server.js
import express from "express";
import pg from "pg";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ✅ 환경변수 로드
dotenv.config();

// ✅ __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ PostgreSQL 연결 설정 (Neon)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ multer 설정 (이미지 저장 폴더 및 이름 지정)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ✅ express 앱 설정
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ 테스트용 기본 라우트
app.get("/", (req, res) => {
  res.send("서버 실행 중입니다.");
});

// ✅ 폼 데이터 저장 API
app.post("/store", upload.fields([
  { name: "images[]" },
  { name: "menuImage[]" },
]), async (req, res) => {
  try {
    console.log("✅ DATABASE_URL:", process.env.DATABASE_URL);

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
      detailAddress
    } = req.body;

    const fullAddress = `${postalCode} ${roadAddress} ${detailAddress}`;

    // ✅ 대표 이미지 경로
    const imageFiles = req.files["images[]"] || [];
    const imagePaths = imageFiles.map((file) => "/uploads/" + file.filename);

    // ✅ 가게 정보 저장
    const storeResult = await pool.query(
      `INSERT INTO hospital_info (
        business_name, business_type, delivery_option, business_hours,
        service_details, event1, event2, facility, pets, parking,
        phone_number, homepage, instagram, facebook,
        additional_desc, address, image1, image2, image3
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id`,
      [
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
        fullAddress,
        imagePaths[0] || null,
        imagePaths[1] || null,
        imagePaths[2] || null,
      ]
    );

    const storeId = storeResult.rows[0].id;

    // ✅ 메뉴 정보 저장
    const menuNames = req.body.menuName || [];
    let menuPrices = req.body.menuPrice || [];
    const menuImages = req.files["menuImage[]"] || [];

    // menuPrices가 단일 문자열로 들어올 경우 배열로 변환
    if (!Array.isArray(menuPrices)) {
      menuPrices = [menuPrices];
    }

    for (let i = 0; i < menuNames.length; i++) {
      const name = menuNames[i] || "";
      const rawPrice = menuPrices[i] || "0";
      const cleanPrice = rawPrice.replace(/,/g, "");
      const price = parseInt(cleanPrice, 10) || 0;

      const imagePath = menuImages[i] ? "/uploads/" + menuImages[i].filename : null;

      await pool.query(
        `INSERT INTO hospital_menu (hospital_id, menu_name, menu_price, menu_image)
         VALUES ($1, $2, $3, $4)`,
        [storeId, name, price, imagePath]
      );
    }

    res.json({ message: "등록 성공", storeId });
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// ✅ 서버 시작
app.listen(port, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${port}`);
});
