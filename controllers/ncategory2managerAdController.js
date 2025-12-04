// controllers/ncategory2managerAdController.js
import pool from "../db.js";

function toNull(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

/** 🟦 이미지 + 링크 슬롯 저장 (업로드 포함) */
export async function saveImageSlot(req, res) {
  const {
    page,
    position,
    slotType,
    slotMode,
    linkUrl,
    textContent,
    storeId,
    businessNo,
    businessName,
    startDate,
    endDate
  } = req.body;

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position은 필수입니다." });
  }

  const slot_type = slotType === "text" ? "text" : "banner";
  const slot_mode = slotMode || "custom";
  const store_id = storeId && storeId.trim() !== "" ? Number(storeId) : null;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = EXCLUDED.slot_type,
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        slot_mode     = EXCLUDED.slot_mode,
        store_id      = EXCLUDED.store_id,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = now()
      RETURNING *;
    `;

    const params = [
      page,
      position,
      slot_type,
      imageUrl,
      toNull(linkUrl),
      toNull(textContent),
      slot_mode,
      store_id,
      toNull(businessNo),
      toNull(businessName),
      toNull(startDate),
      toNull(endDate)
    ];

    const result = await pool.query(sql, params);

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("saveImageSlot ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "이미지 슬롯 저장 중 오류가 발생했습니다.",
    });
  }
}

/** 🟩 등록된 가게 연결 슬롯 (사업자번호 + 상호) */
export async function saveStoreSlot(req, res) {
  const {
    page,
    position,
    slotType,
    slotMode,
    linkUrl,
    textContent,
    storeId,
    businessNo,
    businessName,
    startDate,
    endDate
  } = req.body;

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position은 필수입니다." });
  }
  if (!businessNo || !businessName) {
    return res.status(400).json({ success: false, error: "사업자번호와 상호를 모두 입력해주세요." });
  }

  const slot_type = "store";
  const slot_mode = slotMode || "store";
  const store_id = storeId && storeId.trim() !== "" ? Number(storeId) : null;

  try {
    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = EXCLUDED.slot_type,
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        slot_mode     = EXCLUDED.slot_mode,
        store_id      = EXCLUDED.store_id,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = now()
      RETURNING *;
    `;

    const params = [
      page,
      position,
      slot_type,
      null, // image_url
      toNull(linkUrl),
      toNull(textContent),
      slot_mode,
      store_id,
      businessNo,
      businessName,
      toNull(startDate),
      toNull(endDate)
    ];

    const result = await pool.query(sql, params);

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("saveStoreSlot ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "가게 슬롯 저장 중 오류가 발생했습니다.",
    });
  }
}

/** 🟨 텍스트 슬롯 저장 */
export async function saveTextSlot(req, res) {
  const {
    page,
    position,
    slotType,
    slotMode,
    linkUrl,
    textContent,
    storeId,
    businessNo,
    businessName,
    startDate,
    endDate
  } = req.body;

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position은 필수입니다." });
  }
  if (!textContent || !textContent.trim()) {
    return res.status(400).json({ success: false, error: "textContent는 필수입니다." });
  }

  const slot_type = "text";
  const slot_mode = slotMode || "custom";
  const store_id = storeId && storeId.trim() !== "" ? Number(storeId) : null;

  try {
    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = EXCLUDED.slot_type,
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        slot_mode     = EXCLUDED.slot_mode,
        store_id      = EXCLUDED.store_id,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = now()
      RETURNING *;
    `;

    const params = [
      page,
      position,
      slot_type,
      null, // image_url
      toNull(linkUrl),
      textContent,
      slot_mode,
      store_id,
      toNull(businessNo),
      toNull(businessName),
      toNull(startDate),
      toNull(endDate)
    ];

    const result = await pool.query(sql, params);

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("saveTextSlot ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "텍스트 슬롯 저장 중 오류가 발생했습니다.",
    });
  }
}

/** 특정 page용 슬롯 전체 조회 */
export async function getSlotsByPage(req, res) {
  const { page } = req.query;
  const targetPage = page || "ncategory2manager";

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM admin_ad_slots
      WHERE page = $1
      ORDER BY position ASC, id ASC
      `,
      [targetPage]
    );

    return res.json({
      success: true,
      data: {
        page: targetPage,
        slots: result.rows,
      }
    });
  } catch (err) {
    console.error("getSlotsByPage ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "슬롯 목록 조회 중 오류가 발생했습니다.",
    });
  }
}
