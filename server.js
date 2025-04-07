require("dotenv").config();

const express = require("express");
const path = require("path");
const multer = require("multer");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 3000;
const db = require("./db");

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.send("✅ DB 연결 성공! 현재 시간: " + result.rows[0].now);
  } catch (err) {
    console.error("❌ DB 연결 실패:", err);
    res.status(500).send("DB 연결 실패");
  }
});

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

// MySQL 연결
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "my_project",
  port: 3306,
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL 연결 실패:", err);
    // 여기서 return 하지 않음!
  } else {
    console.log("✅ MySQL 연결 성공!");
  }
});

// [POST] 병원 정보 + 메뉴 저장
app.post("/store", fieldsUpload, (req, res) => {
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

  const sqlInfo = `
    INSERT INTO hospital_info
    (name, category, delivery, open_hours, service_details, event1, event2,
     facility, pets, parking, phone, homepage, additional_desc,
     postal_code, road_address, detail_address, instagram, facebook)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const valuesInfo = [
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
    additionalDesc,
    postalCode,
    roadAddress,
    detailAddress,
    instagram,
    facebook,
  ];

  db.query(sqlInfo, valuesInfo, (err, result) => {
    if (err) {
      console.error("❌ hospital_info INSERT 실패:", err);
      return res.status(500).json({ error: "병원 정보 저장 실패" });
    }

    const hospitalId = result.insertId;

    const menuNames = req.body["menuName[]"];
    const menuPrices = req.body["menuPrice[]"];
    const menuImageFiles = req.files["menuImage[]"];

    const safeNames = Array.isArray(menuNames)
      ? menuNames
      : menuNames
      ? [menuNames]
      : [];
    const safePrices = Array.isArray(menuPrices)
      ? menuPrices
      : menuPrices
      ? [menuPrices]
      : [];

    let menuInserts = [];

    for (let i = 0; i < safeNames.length; i++) {
      const thisName = safeNames[i];
      const thisPrice = safePrices[i] || 0;
      let imagePath = null;
      if (menuImageFiles && menuImageFiles[i]) {
        imagePath = "/uploads/" + menuImageFiles[i].filename;
      }

      const sqlMenu = `
        INSERT INTO hospital_menu (hospital_id, menu_name, menu_price, menu_image)
        VALUES (?, ?, ?, ?)
      `;

      const valuesMenu = [hospitalId, thisName, thisPrice, imagePath];

      menuInserts.push(
        new Promise((resolve, reject) => {
          db.query(sqlMenu, valuesMenu, (err2, result2) => {
            if (err2) return reject(err2);
            resolve(result2);
          });
        })
      );
    }

    Promise.all(menuInserts)
      .then(() => {
        res.json({ success: true, message: "병원 정보 + 메뉴 저장 완료!" });
      })
      .catch((errMenus) => {
        console.error("❌ 메뉴 INSERT 중 오류:", errMenus);
        res.status(500).json({ error: "일반 메뉴 저장 실패" });
      });
  });
});

// [GET] 병원 상세 정보 DB에서 조회
app.get("/store/:id", (req, res) => {
  const { id } = req.params;

  const sqlInfo = "SELECT * FROM hospital_info WHERE id = ?";
  db.query(sqlInfo, [id], (err, infoResult) => {
    if (err) {
      console.error("❌ 병원 정보 조회 실패:", err);
      return res.status(500).json({ error: "서버 오류: 병원 정보 조회 실패" });
    }

    if (infoResult.length === 0) {
      return res.status(404).json({ error: "해당 ID의 병원 정보가 없습니다." });
    }

    const info = infoResult[0];

    const sqlMenu = "SELECT * FROM hospital_menu WHERE hospital_id = ?";
    db.query(sqlMenu, [id], (err2, menuResult) => {
      if (err2) {
        console.error("❌ 메뉴 조회 실패:", err2);
        return res.status(500).json({ error: "서버 오류: 메뉴 조회 실패" });
      }

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
        menuItems: menuResult.map((menu) => ({
          menuName: menu.menu_name,
          menuPrice: menu.menu_price,
          menuImageUrl: menu.menu_image,
        })),
      };

      res.json(data);
    });
  });
});

// 루트 라우터 (확인용)
app.get("/", (req, res) => {
  res.send("✅ Node.js 서버 작동 중입니다!");
});

// 서버 실행
app.listen(PORT, () => {
  console.log("🚀 Cloudtype 서버 실행 중: https://www.hongbono1.com");
});
