import express from "express";
import pg from "pg";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 환경변수 로드
dotenv.config();

// __dirname 설정 (ESM용)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB 연결
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 기본 설정
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 파일 업로드용 설정
const upload = multer({ dest: "uploads/" });

// 병원 등록 API
app.post("/store", upload.single("images[]"), async (req, res) => {
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
    postalCode,
    roadAddress,
    detailAddress,
    menuName,
    menuPrice,
  } = req.body;

  const address = `${postalCode} ${roadAddress} ${detailAddress}`;
  const event = `${event1 || ""} ${event2 || ""}`;
  const contact = phoneNumber;
  const website = [homepage, instagram, facebook].filter(Boolean).join("\n");
  const name = businessName;
  const category = businessType;
  const delivery = deliveryOption === "가능";
  const hours = businessHours;
  const description = serviceDetails;

  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const client = await pool.connect();

    const insertHospital = `
      INSERT INTO hospital_info (
        name, category, delivery, hours, description, event,
        facility, pets, parking, contact, website, address, image_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id;
    `;

    const result = await client.query(insertHospital, [
      name,
      category,
      delivery,
      hours,
      description,
      event,
      facility,
      pets === "가능",
      parking === "가능",
      contact,
      website,
      address,
      image_url,
    ]);

    const hospitalId = result.rows[0].id;

    if (menuName && menuPrice) {
      const insertMenu = `
        INSERT INTO hospital_menu (hospital_id, menu_name, price)
        VALUES ($1, $2, $3);
      `;

      const names = Array.isArray(menuName) ? menuName : [menuName];
      const prices = Array.isArray(menuPrice) ? menuPrice : [menuPrice];

      for (let i = 0; i < names.length; i++) {
        const menuNameTrimmed = names[i].trim();
        const priceCleaned = prices[i].replace(/,/g, "");
        await client.query(insertMenu, [hospitalId, menuNameTrimmed, priceCleaned]);
      }
    }

    client.release();
    res.status(200).json({ success: true, id: hospitalId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/store/:id", async (req, res) => {
  const hospitalId = req.params.id;

  try {
    const client = await pool.connect();

    const infoQuery = "SELECT * FROM hospital_info WHERE id = $1";
    const menuQuery =
      "SELECT menu_name, price FROM hospital_menu WHERE hospital_id = $1";

    const infoResult = await client.query(infoQuery, [hospitalId]);
    const menuResult = await client.query(menuQuery, [hospitalId]);

    client.release();

    if (infoResult.rows.length === 0) {
      return res.status(404).json({ message: "병원 정보를 찾을 수 없습니다." });
    }

    res.status(200).json({
      info: infoResult.rows[0],
      menu: menuResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 My Store Server is Running!");
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
