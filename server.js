// server.js
import express from "express";
import pg from "pg";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("서버 실행 중입니다.");
});

app.post(
  "/store",
  upload.fields([
    { name: "images[]" },
    { name: "menuImage[]" },
    { name: "businessCertImage" },
  ]),
  async (req, res) => {
    try {
      const {
        bizNumber,
        ownerName,
        birthDate,
        ownerEmail,
        ownerAddress,
        ownerPhone,
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

      const fullStoreAddress = `${postalCode} ${roadAddress} ${detailAddress}`;

      // 이미지 파일 경로 처리
      const imageFiles = req.files["images[]"] || [];
      const imagePaths = imageFiles.map(file => "/uploads/" + file.filename);

      const certFile = req.files["businessCertImage"]?.[0];
      const certPath = certFile ? "/uploads/" + certFile.filename : null;

      const salt = await bcrypt.genSalt(10);
      const hashedBizNumber = await bcrypt.hash(bizNumber, salt);
      const hashedPhone = await bcrypt.hash(ownerPhone, salt);

      const ownerResult = await pool.query(
        `INSERT INTO owner_info (biz_number, name, birth_date, email, address, phone, cert_image)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          hashedBizNumber,
          ownerName,
          birthDate,
          ownerEmail,
          ownerAddress,
          hashedPhone,
          certPath,
        ]
      );

      const ownerId = ownerResult.rows[0].id;

      const storeResult = await pool.query(
        `INSERT INTO store_info (
          owner_id, business_name, business_type, delivery_option, business_hours,
          service_details, event1, event2, facility, pets, parking,
          phone_number, homepage, instagram, facebook,
          additional_desc, address, image1, image2, image3
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING id`,
        [
          ownerId,
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
          fullStoreAddress,
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
        const imagePath = menuImages[i] ? "/uploads/" + menuImages[i].filename : null;

        await pool.query(
          `INSERT INTO store_menu (store_id, menu_name, menu_price, menu_image)
           VALUES ($1, $2, $3, $4)`,
          [storeId, name, price, imagePath]
        );
      }

      res.json({ message: "등록 성공", storeId });
    } catch (error) {
      console.error("❌ 등록 오류:", error);
      res.status(500).json({ message: "서버 오류" });
    }
  }
);

app.get("/store/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const storeQuery = await pool.query(
      `SELECT * FROM store_info WHERE id = $1`,
      [id]
    );

    const menuQuery = await pool.query(
      `SELECT menu_name, menu_price, menu_image FROM store_menu WHERE store_id = $1`,
      [id]
    );

    if (storeQuery.rows.length === 0) {
      return res.status(404).json({ message: "가게 정보를 찾을 수 없습니다." });
    }

    const store = storeQuery.rows[0];
    const menu = menuQuery.rows.map(item => ({
      menuName: item.menu_name,
      menuPrice: item.menu_price,
      menuImageUrl: item.menu_image,
    }));

    res.json({
      store: {
        businessName: store.business_name,
        businessType: store.business_type,
        deliveryOption: store.delivery_option,
        businessHours: store.business_hours,
        serviceDetails: store.service_details,
        event1: store.event1,
        event2: store.event2,
        facility: store.facility,
        pets: store.pets,
        parking: store.parking,
        contactPhone: store.phone_number,
        homepage: store.homepage,
        instagram: store.instagram,
        facebook: store.facebook,
        additionalDesc: store.additional_desc,
        address: store.address,
        images: [store.image1, store.image2, store.image3].filter(Boolean)
      },
      menu
    });
  } catch (err) {
    console.error("❌ /store/:id 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중! http://localhost:${port}`);
});
