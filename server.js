// 📁 server.js
import express from "express";
import pg from "pg";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config(); // .env 파일 로드

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
const port = process.env.PORT || 3000;

// 🔧 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 📷 multer 설정 - 이미지 저장
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// 🛠 /store: 병원 등록 API
app.post("/store", upload.fields([
  { name: "images[]" },
  { name: "menuImage[]" }
]), async (req, res) => {
  try {
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
      menuName,
      menuPrice
    } = req.body;

    // 📦 이미지 파일 경로들
    const imagePaths = req.files["images[]"]?.map(file => file.filename) || [];

    // 📥 병원 정보 저장
    const insertHospitalQuery = `
      INSERT INTO hospital_info (
        business_name, business_type, delivery_option, business_hours,
        service_details, event1, event2, facility, pets, parking,
        phone_number, homepage, instagram, facebook,
        additional_desc, postal_code, road_address, detail_address, image_paths
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id
    `;
    const result = await pool.query(insertHospitalQuery, [
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
      imagePaths
    ]);

    const hospitalId = result.rows[0].id;

    // 📥 메뉴 저장
    const menuNames = Array.isArray(menuName) ? menuName : [menuName];
    const menuPrices = Array.isArray(menuPrice) ? menuPrice : [menuPrice];
    const menuImages = req.files["menuImage[]"] || [];

    for (let i = 0; i < menuNames.length; i++) {
      await pool.query(`
        INSERT INTO hospital_menu (hospital_id, menu_name, menu_price, menu_image_path)
        VALUES ($1, $2, $3, $4)
      `, [
        hospitalId,
        menuNames[i],
        parseInt(menuPrices[i]) || 0,
        menuImages[i]?.filename || null
      ]);
    }

    res.json({ message: "병원 정보 및 메뉴 저장 성공" });
  } catch (error) {
    console.error("❌ 서버 오류:", error);
    res.status(500).json({ message: "서버 오류 발생" });
  }
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});
