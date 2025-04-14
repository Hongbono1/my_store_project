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
console.log("✅ DATABASE_URL:", process.env.DATABASE_URL);

// ✅ __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ DB 연결
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ✅ Express 앱 초기화
const app = express();
const port = process.env.PORT || 3000;

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
      postalCode, roadAddress, detailAddress,
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

    // ✅ 메뉴 입력값 확인
    const menuNames = req.body["menuName[]"];
    const menuPrices = req.body["menuPrice[]"];
    const menuImages = req.files["menuImage[]"] || [];

    console.log("🧪 메뉴 이름:", menuNames);
    console.log("🧪 메뉴 가격:", menuPrices);

    // 빈 값 방지 + 배열 강제 변환
    const names = Array.isArray(menuNames) ? menuNames : (menuNames ? [menuNames] : []);
    const prices = Array.isArray(menuPrices) ? menuPrices : (menuPrices ? [menuPrices] : []);

    // name 길이에 맞춰 price 채우기
    while (prices.length < names.length) {
      prices.push("0");
    }

    for (let i = 0; i < names.length; i++) {
      const name = names[i] ?? "";
      const rawPrice = prices[i] ?? "0";
      const clean = typeof rawPrice === "string" ? rawPrice.replace(/,/g, "") : "0";
      const price = parseFloat(clean) || 0;
      const image = menuImages[i]?.filename || null;

      console.log(`🧾 ${i + 1}번 메뉴 → 이름: ${name}, 가격: ${price}, 이미지: ${image}`);

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
