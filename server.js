// server.js
import express from "express";
import pg from "pg";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// 환경변수 로드
dotenv.config();

// __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL 연결 설정 (예: Neon)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Multer 설정 (파일 업로드)
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

// Express 앱 설정
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 기본 테스트 라우트
app.get("/", (req, res) => {
  res.send("서버 실행 중입니다.");
});

// 폼 데이터 저장 API (POST /store)
// 클라이언트의 폼에서 대표 이미지(images[])와 메뉴 이미지(menuImage[])를 업로드할 수 있도록 처리
app.post("/store", upload.fields([
  { name: "images[]" },
  { name: "menuImage[]" },
]), async (req, res) => {
  try {
    console.log("✅ DATABASE_URL:", process.env.DATABASE_URL);

    // 클라이언트로부터 전달된 정보 추출
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

    const fullAddress = `${postalCode} ${roadAddress} ${detailAddress}`;

    // 대표 이미지 처리: images[] 배열이 없다면 빈 배열로 처리
    const imageFiles = req.files["images[]"] || [];
    const imagePaths = imageFiles.map(file => "/uploads/" + file.filename);

    // 대표 정보(DB 테이블: hospital_info) 저장
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

    // 메뉴 정보 저장
    // menuName와 menuPrice를 클라이언트로부터 받습니다.
    const menuNames = req.body.menuName || [];

    // menuPrice는 값이 하나일 수도 있으므로 배열 형태로 보정
    let menuPrices = req.body.menuPrice;
    if (!Array.isArray(menuPrices)) {
      menuPrices = menuPrices ? [menuPrices] : [];
    }

    const menuImages = req.files["menuImage[]"] || [];

    // 각 메뉴에 대해 순회하며 데이터베이스에 저장합니다.
    for (let i = 0; i < menuNames.length; i++) {
      const name = menuNames[i] || "";
      // 가격 값은 화면에서는 "12,000"처럼 나오지만, 서버에서는 숫자만 필요합니다.
      // 따라서 숫자 이외의 문자를 모두 제거합니다.
      const rawPrice = menuPrices[i] || "0";
      const cleanPrice = rawPrice.replace(/[^\d.]/g, ""); // 콤마, 원 등 모든 숫자가 아닌 문자 제거
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

// 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${port}`);
});
