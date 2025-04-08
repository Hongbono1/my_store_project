app.post("/store", fieldsUpload, async (req, res) => {
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

  try {
    // 병원 정보 저장
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
        businessName,
        businessType,
        deliveryOption === "true",
        businessHours,
        serviceDetails,
        event1,
        event2,
        facility,
        pets === "true",
        parking === "true",
        phoneNumber,
        homepage,
        instagram,
        facebook,
        additionalDesc,
        postalCode,
        roadAddress,
        detailAddress,
      ]
    );

    const hospitalId = infoResult.rows[0].id;

    // 메뉴 정보 준비
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

    res.json({ success: true, message: "✅ 병원 정보 + 메뉴 저장 완료!" });
  } catch (err) {
    console.error("❌ 저장 실패:", err);
    res.status(500).json({ error: "DB 저장 실패" });
  }
});
