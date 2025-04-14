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
console.log("✅ DATABASE_URL:", process.env.DATABASE_URL); // 로그 확인용

// ✅ __dirname 대체 코드
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ PostgreSQL 연결
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Express 서버 설정
const app = express();
const port = process.env.PORT || 3000;

// ✅ 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// ✅ Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ✅ POST /store
app.post("/store", upload.fields([
  { name: "images[]", maxCount: 3 },
  { name: "menuImage[]", maxCount: 20 },
]), async (req, res) => {
  try {
    const {
      businessName, businessType, deliveryOption, businessHours,
      serviceDetails, event1, event2, facility, pets, parking,
      phoneNumber, homepage, instagram, facebook, additionalDesc,
      postalCode, roadAddress, detailAddress
    } = req.body;

    const fullAddress = `${roadAddress} ${detailAddress}`.trim();

    const imagePaths = (req.files["images[]"] || []).map(file => file.filename);

    const storeResult = await pool.query(
      `INSERT INTO hospital_info (
        business_name, business_type, delivery_option, business_hours, service_details,
        event1, event2, facility, pets, parking, phone_number,
        homepage, instagram, facebook, additional_desc, postal_code,
        road_address, detail_address, address, image_paths)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               $11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        businessName, businessType, deliveryOption, businessHours, serviceDetails,
        event1, event2, facility, pets, parking, phoneNumber,
        homepage, instagram, facebook, additionalDesc, postalCode,
        roadAddress, detailAddress, fullAddress, imagePaths
      ]
    );

    const storeId = storeResult.rows[0].id;

    const menuNames = req.body["menuName[]"];
    const menuPrices = req.body["menuPrice[]"];
    const menuImages = req.files["menuImage[]"] || [];

    const names = Array.isArray(menuNames) ? menuNames : [menuNames];
    const prices = Array.isArray(menuPrices) ? menuPrices : [menuPrices];

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const rawPrice = prices[i] || "0"; // ✅ null 또는 undefined 방지
      const price = parseInt(rawPrice.replace(/,/g, ""), 10) || 0;
      const image = menuImages[i]?.filename || null;

      await pool.query(
        `INSERT INTO hospital_menu (store_id, name, price, image_path)
         VALUES ($1, $2, $3, $4)`,
        [storeId, name, price, image]
      );
    }

    res.status(200).json({ message: "등록 완료", storeId });

  } catch (err) {
    console.error("❌ 오류 발생:", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

// ✅ 서버 시작
app.listen(port, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${port}`);
});
