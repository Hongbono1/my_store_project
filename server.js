// server.js
import dotenv from "dotenv";
dotenv.config();   

import express from "express";
import pg from "pg";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import fetch from "node-fetch";
import fs from "fs";

console.log("✅ DATABASE_URL:", process.env.DATABASE_URL);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, "_")
      .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9-_]/g, "");
    const safe = Date.now() + "-" + base + ext;
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

app.get("/", (_, res) => res.send("서버 실행 중입니다."));

app.post("/verify-biz", async (req, res) => {
  try {
    const { b_no } = req.body;
    const businessNumbers = Array.isArray(b_no) ? b_no : [b_no];
    const ntsUrl = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${process.env.BIZ_API_KEY}`;
    const response = await fetch(ntsUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify({ b_no: businessNumbers }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ 사업자 인증 오류:", err.message);
    res.status(500).json({ message: "서버 오류" });
  }
});

// .env에 있는 KAKAO_API_KEY 값을 클라이언트에 전달
app.get("/kakao-key", (req, res) => {
  res.json({ key: process.env.KAKAO_MAP_KEY });
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
      const bizNumber =
        (req.body.bizNumber1 || "") +
        (req.body.bizNumber2 || "") +
        (req.body.bizNumber3 || "");

      const {
        ownerName,
        birthDate,
        ownerEmail,
        ownerAddress,
        ownerPhone,
        businessName,
        businessCategory,     
        businessSubcategory,
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

      const fullStoreAddress = `${postalCode} ${roadAddress} ${detailAddress}`.trim();
      const imageFiles = req.files["images[]"] || [];
      const imagePaths = imageFiles.map((f) => "/uploads/" + f.filename);

      const certFile = req.files["businessCertImage"]?.[0];
      const certPath = certFile ? "/uploads/" + certFile.filename : null;

      const salt = await bcrypt.genSalt(10);
      const hashedBizNumber = await bcrypt.hash(bizNumber, salt);
      const hashedOwnerPhone = await bcrypt.hash(ownerPhone || "", salt);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const ownerResult = await client.query(
          `INSERT INTO owner_info
           (biz_number, name, birth_date, email, address, phone, cert_image)
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

        const storeResult = await client.query(
          `INSERT INTO store_info (
             owner_id,business_name,business_category,business_subcategory,business_type,delivery_option,business_hours,
             service_details,event1,event2,facility,pets,parking,
             phone_number,homepage,instagram,facebook,
             additional_desc,address,image1,image2,image3)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                   $12,$13,$14,$15,$16,$17,$18,$19,$20)
           RETURNING id`,
          [
            ownerId,
            businessName,
            businessCategory,
            business_subcategory,
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

        const categories = Array.isArray(req.body.menuCategory)
          ? req.body.menuCategory
          : req.body.menuCategory
            ? [req.body.menuCategory]
            : [];
        const menuNames = Array.isArray(req.body.menuName)
          ? req.body.menuName
          : req.body.menuName
            ? [req.body.menuName]
            : [];
        let menuPrices = Array.isArray(req.body.menuPrice)
          ? req.body.menuPrice
          : req.body.menuPrice
            ? [req.body.menuPrice]
            : [];
        const descriptions = Array.isArray(req.body.menuDesc)
          ? req.body.menuDesc
          : req.body.menuDesc
            ? [req.body.menuDesc]
            : [];

        const menuImages = req.files["menuImage[]"] || [];

        for (let i = 0; i < menuNames.length; i++) {
          const name = menuNames[i] || "";
          const rawPrice = (menuPrices[i] || "0").toString();
          const price = parseInt(rawPrice.replace(/[^\d]/g, ""), 10) || 0;
          const imgPath =
            menuImages[i]?.filename ? "/uploads/" + menuImages[i].filename : null;

          const category = categories[i] || "기타";

          await client.query(
            `INSERT INTO store_menu
               (store_id, category, menu_name, menu_price, menu_image, menu_desc)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              storeId,
              category,
              name,
              price,
              imgPath,
              descriptions[i] || "",
            ]
          );
        }

        await client.query("COMMIT");
        res.json({ message: "등록 성공", storeId });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ 등록 트랜잭션 오류:", err.message);
        res.status(500).json({ message: "서버 오류" });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("❌ 등록 처리 오류:", err.message);
      res.status(500).json({ message: "서버 오류" });
    }
  }
);

app.get("/store/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const storeQ = await pool.query(`SELECT * FROM store_info WHERE id=$1`, [id]);
    if (!storeQ.rowCount)
      return res.status(404).json({ message: "가게 정보를 찾을 수 없습니다." });

    const menuQ = await pool.query(
      `SELECT
           COALESCE(NULLIF(trim(category), ''), '기타') AS category,
           menu_name,
           menu_price,
           menu_image
        FROM store_menu
       WHERE store_id = $1`,
       [id]
    );

    const s = storeQ.rows[0];

    // 🔹 배열로 묶어서 프런트로 전달
    const eventsArr = [s.event1, s.event2].filter(Boolean);
    const addInfoArr = [s.facility, s.pets, s.parking].filter(Boolean);

    res.json({
      store: {
        businessName: s.business_name,
        businessType: s.business_type,
        deliveryOption: s.delivery_option,
        businessHours: s.business_hours,
        serviceDetails: s.service_details,

        /* 프런트가 바로 쓸 수 있는 배열 */
        events: eventsArr,      // 예) ["신규 방문 이벤트", "여름 할인"]
        additionalInfo: addInfoArr,     // 예) ["장애인편의 시설", "반려동물 출입", "주차정보"]

        contactPhone: s.phone_number,
        homepage: s.homepage,
        instagram: s.instagram,
        facebook: s.facebook,
        additionalDesc: s.additional_desc,
        address: s.address,
        images: [s.image1, s.image2, s.image3].filter(Boolean)
      },
      menu: menuQ.rows.map(m => ({
        category:    m.category,
        menuName:    m.menu_name,
        menuPrice:   m.menu_price,
        menuImageUrl:m.menu_image
      }))
    });
  } catch (err) {
    console.error("❌ 상세 조회 오류:");
    console.error(err);             // ← 객체 전체 출력
    console.error(err.stack);       // ← 스택까지 출력
    res.status(500).json({ message: "서버 오류" });
  }
});

app.get("/kakao-key", (req, res) => {
  res.json({ key: process.env.KAKAO_API_KEY });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 서버 실행 중! http://localhost:3000");
});