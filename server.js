// server.js
import express from "express";
import pg from "pg";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL 연결 설정
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 이미지 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Express 앱 설정
const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS 명시 설정
app.use(cors({
  origin: ["https://www.hongbono1.com", "http://localhost:3000"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 기본 페이지
app.get("/", (req, res) => {
  res.send("서버 실행 중입니다.");
});

// ✅ 가게 등록 API
app.post(
  "/store",
  upload.fields([
    { name: "images[]" },
    { name: "menuImage[]" },
  ]),
  async (req, res) => {
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
        detailAddress,
      } = req.body;

      const fullAddress = `${postalCode} ${roadAddress} ${detailAddress}`;
      const imageFiles = req.files["images[]"] || [];
      const imagePaths = imageFiles.map(file => "/uploads/" + file.filename);

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

      const menuNames = req.body.menuName || [];
      let menuPrices = req.body.menuPrice;
      if (!Array.isArray(menuPrices)) {
        menuPrices = typeof menuPrices === "string" ? [menuPrices] : [];
      }

      const menuImages = req.files["menuImage[]"] || [];

      for (let i = 0; i < menuNames.length; i++) {
        const name = menuNames[i] || "";
        const priceRaw = (menuPrices.length > i && typeof menuPrices[i] === "string")
          ? menuPrices[i]
          : "0";
        const cleanPrice = priceRaw.replace(/[^\d.]/g, "");
        const price = parseInt(cleanPrice, 10) || 0;
        const imagePath = menuImages[i]
          ? "/uploads/" + menuImages[i].filename
          : null;

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
  }
);

// ✅ 상세 페이지용 GET API: /store/:id
app.get("/store/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const hospitalQuery = await pool.query(
      `SELECT * FROM hospital_info WHERE id = $1`,
      [id]
    );

    const menuQuery = await pool.query(
      `SELECT menu_name, menu_price, menu_image FROM hospital_menu WHERE hospital_id = $1`,
      [id]
    );

    if (hospitalQuery.rows.length === 0) {
      return res.status(404).json({ message: "가게 정보를 찾을 수 없습니다." });
    }

    const hospital = hospitalQuery.rows[0];
    const menu = menuQuery.rows.map(item => ({
      menuName: item.menu_name,
      menuPrice: item.menu_price,
      menuImageUrl: item.menu_image,
    }));

    res.json({
      hospital: {
        businessName: hospital.business_name,
        businessType: hospital.business_type,
        deliveryOption: hospital.delivery_option,
        businessHours: hospital.business_hours,
        serviceDetails: hospital.service_details,
        event1: hospital.event1,
        event2: hospital.event2,
        facility: hospital.facility,
        pets: hospital.pets,
        parking: hospital.parking,
        contactPhone: hospital.phone_number,
        homepage: hospital.homepage,
        instagram: hospital.instagram,
        facebook: hospital.facebook,
        additionalDesc: hospital.additional_desc,
        address: hospital.address,
        images: [hospital.image1, hospital.image2, hospital.image3].filter(Boolean)
      },
      menu
    });
  } catch (err) {
    console.error("❌ /store/:id 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 서버 실행
app.listen(port, () => {
  console.log(`서버 실행 중! ✅ 링크 => http://localhost:${port}`);
});
