// server.js
import express from "express";
import pg from "pg";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import fetch from "node-fetch"; // ✅ 국세청 API 중계용 fetch 추가

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL 연결 설정
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Multer 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("서버 실행 중입니다.");
});

/* ------------------------------------------------------------------
   ✅ 사업자 등록번호 진위 확인 중계 API
-------------------------------------------------------------------*/
app.post("/verify-biz", async (req, res) => {
  try {
    const { b_no } = req.body; // 프런트에서 받은 사업자번호 10자리
    const ntsUrl = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${process.env.NTS_KEY}`;
    const response = await fetch(ntsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b_no: [b_no] }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ 사업자 인증 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

/* ------------------------------------------------------------------
   🔄 가게 정보 등록 API  (/store)
-------------------------------------------------------------------*/
app.post(
  "/store",
  upload.fields([
    { name: "images[]" },
    { name: "menuImage[]" },
    { name: "businessCertImage" },
  ]),
  async (req, res) => {
    try {
      // 업주 정보 및 가게 정보 파싱
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

      // 업로드 파일 처리
      const imageFiles = req.files["images[]"] || [];
      const imagePaths = imageFiles.map((f) => "/uploads/" + f.filename);

      const certFile = req.files["businessCertImage"]?.[0];
      const certPath = certFile ? "/uploads/" + certFile.filename : null;

      // 비식별화(단방향): bcrypt (추후 AES 양방향 가능)
      const salt = await bcrypt.genSalt(10);
      const hashedBizNumber = await bcrypt.hash(bizNumber, salt);
      const hashedOwnerPhone = await bcrypt.hash(ownerPhone, salt);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        /* 1) owner_info 저장 */
        const ownerResult = await client.query(
          `INSERT INTO owner_info (biz_number, name, birth_date, email, address, phone, cert_image)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            hashedBizNumber,
            ownerName,
            birthDate,
            ownerEmail,
            ownerAddress,
            hashedOwnerPhone,
            certPath,
          ]
        );
        const ownerId = ownerResult.rows[0].id;

        /* 2) store_info 저장 */
        const storeResult = await client.query(
          `INSERT INTO store_info (
             owner_id, business_name, business_type, delivery_option, business_hours,
             service_details, event1, event2, facility, pets, parking,
             phone_number, homepage, instagram, facebook,
             additional_desc, address, image1, image2, image3)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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

        /* 3) 메뉴 정보 저장 */
        const menuNames = req.body.menuName || [];
        let menuPrices = req.body.menuPrice;
        if (!Array.isArray(menuPrices)) {
          menuPrices = typeof menuPrices === "string" ? [menuPrices] : [];
        }
        const menuImages = req.files["menuImage[]"] || [];

        for (let i = 0; i < menuNames.length; i++) {
          const name = menuNames[i] || "";
          const rawPrice =
            menuPrices.length > i && typeof menuPrices[i] === "string"
              ? menuPrices[i]
              : "0";
          const price = parseInt(rawPrice.replace(/[^\d]/g, ""), 10) || 0;
          const img = menuImages[i] ? "/uploads/" + menuImages[i].filename : null;
          await client.query(
            `INSERT INTO store_menu (store_id, menu_name, menu_price, menu_image)
             VALUES ($1,$2,$3,$4)`,
            [storeId, name, price, img]
          );
        }

        await client.query("COMMIT");
        res.json({ message: "등록 성공", storeId });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ 등록 오류:", err);
        res.status(500).json({ message: "서버 오류" });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("❌ 오류 발생:", err);
      res.status(500).json({ message: "서버 오류" });
    }
  }
);

/* ------------------------------------------------------------------
   📄 상세 조회 API  (/store/:id)
-------------------------------------------------------------------*/
app.get("/store/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const storeQuery = await pool.query(`SELECT * FROM store_info WHERE id=$1`, [id]);
    const menuQuery = await pool.query(
      `SELECT menu_name, menu_price, menu_image FROM store_menu WHERE store_id=$1`,
      [id]
    );
    if (!storeQuery.rowCount) return res.status(404).json({ message: "가게 정보를 찾을 수 없습니다." });

    const s = storeQuery.rows[0];
    const menu = menuQuery.rows.map(m => ({
      menuName: m.menu_name,
      menuPrice: m.menu_price,
      menuImageUrl: m.menu_image,
    }));

    res.json({
      store: {
        businessName: s.business_name,
        businessType: s.business_type,
        deliveryOption: s.delivery_option,
        businessHours: s.business_hours,
        serviceDetails: s.service_details,
        event1: s.event1,
        event2: s.event2,
        facility: s.facility,
        pets: s.pets,
        parking: s.parking,
        contactPhone: s.phone_number,
        homepage: s.homepage,
        instagram: s.instagram,
        facebook: s.facebook,
        additionalDesc: s.additional_desc,
        address: s.address,
        images: [s.image1, s.image2, s.image3].filter(Boolean),
      },
      menu,
    });
  } catch (err) {
    console.error("❌ /store/:id 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

/* ------------------------------------------------------------------*/
app.listen(port, () => {
  console.log(`🚀 서버 실행 중! http://localhost:${port}`);
});