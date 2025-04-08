require("dotenv").config();

const express = require("express");
const path = require("path");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const db = require("./db"); // PostgreSQL 연결만 사용

// 정적 파일 경로 설정
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// JSON & URL 인코딩 파싱
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer 파일 업로드 설정
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });
const fieldsUpload = upload.fields([
  { name: "images[]", maxCount: 3 },
  { name: "menuImage[]", maxCount: 20 },
]);

// 연결 테스트 라우터
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.send("\u2705 DB \uc5f0\uacb0 \uc131\uacf5! \ud604\uc7ac \uc2dc\uac04: " + result.rows[0].now);
  } catch (err) {
    console.error("\u274c DB \uc5f0\uacb0 \uc2e4\ud328:", err);
    res.status(500).send("DB \uc5f0\uacb0 \uc2e4\ud328");
  }
});

// [POST] \ubcd1\uc6d0 \uc815\ubcf4 + \uba54\ub274 \uc800\uc7a5
app.post("/store", fieldsUpload, async (req, res) => {
  const {
    businessName, businessType, deliveryOption, businessHours,
    serviceDetails, event1, event2, facility, pets, parking,
    phoneNumber, homepage, instagram, facebook, additionalDesc,
    postalCode, roadAddress, detailAddress,
  } = req.body;

  try {
    const infoResult = await db.query(
      `
      INSERT INTO hospital_info (
        name, category, delivery, open_hours, service_details,
        event1, event2, facility, pets, parking,
        phone, homepage, instagram, facebook, additional_desc,
        postal_code, road_address, detail_address
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18
      )
      RETURNING id
      `,
      [
        businessName, businessType, deliveryOption === "true", businessHours,
        serviceDetails, event1, event2, facility, pets === "true", parking === "true",
        phoneNumber, homepage, instagram, facebook, additionalDesc,
        postalCode, roadAddress, detailAddress
      ]
    );

    const hospitalId = infoResult.rows[0].id;

    const menuNames = req.body["menuName[]"];
    const menuPrices = req.body["menuPrice[]"];
    const menuImageFiles = req.files["menuImage[]"];

    const safeNames = Array.isArray(menuNames) ? menuNames : menuNames ? [menuNames] : [];
    const safePrices = Array.isArray(menuPrices) ? menuPrices : menuPrices ? [menuPrices] : [];

    for (let i = 0; i < safeNames.length; i++) {
      const thisName = safeNames[i];
      const thisPrice = safePrices[i] || 0;
      let imagePath = null;
      if (menuImageFiles && menuImageFiles[i]) {
        imagePath = "/uploads/" + menuImageFiles[i].filename;
      }

      await db.query(
        `
        INSERT INTO hospital_menu (
          hospital_id, menu_name, menu_price, menu_image
        ) VALUES (
          $1, $2, $3, $4
        )
        `,
        [hospitalId, thisName, thisPrice, imagePath]
      );
    }

    res.json({ success: true, message: "\u2705 \ubcd1\uc6d0 \uc815\ubcf4 + \uba54\ub274 \uc800\uc7a5 \uc644\ub8cc!" });
  } catch (err) {
    console.error("\u274c \uc800\uc7a5 \uc2e4\ud328:", err);
    res.status(500).json({ error: "DB \uc800\uc7a5 \uc2e4\ud328" });
  }
});

// [GET] \ubcd1\uc6d0 \uc0c1\uc138 \uc815\ubcf4 \uc870\ud68c
app.get("/store/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const infoResult = await db.query("SELECT * FROM hospital_info WHERE id = $1", [id]);
    if (infoResult.rows.length === 0) {
      return res.status(404).json({ error: "\ud574\ub2f9 ID\uc758 \ubcd1\uc6d0 \uc815\ubcf4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4." });
    }

    const info = infoResult.rows[0];

    const menuResult = await db.query("SELECT * FROM hospital_menu WHERE hospital_id = $1", [id]);

    const data = {
      businessName: info.name,
      businessType: info.category,
      deliveryOption: info.delivery,
      businessHours: info.open_hours,
      serviceDetails: info.service_details,
      event1: info.event1,
      event2: info.event2,
      facility: info.facility,
      pets: info.pets,
      parking: info.parking,
      phoneNumber: info.phone,
      homepage: info.homepage,
      instagram: info.instagram,
      facebook: info.facebook,
      additionalDesc: info.additional_desc,
      images: [],
      postalCode: info.postal_code,
      roadAddress: info.road_address,
      detailAddress: info.detail_address,
      menuItems: menuResult.rows.map((menu) => ({
        menuName: menu.menu_name,
        menuPrice: menu.menu_price,
        menuImageUrl: menu.menu_image,
      }))
    };

    res.json(data);
  } catch (err) {
    console.error("\u274c \uc870\ud68c \uc2e4\ud328:", err);
    res.status(500).json({ error: "DB \uc870\ud68c \uc2e4\ud328" });
  }
});

// \uc11c\ubc84 \uc2e4\ud589
app.listen(PORT, () => {
  console.log("\ud83d\ude80 Cloudtype \uc11c\ubc84 \uc2e4\ud589 \uc911: https://www.hongbono1.com");
});