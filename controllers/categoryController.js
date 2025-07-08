// controllers/categoryController.js

export async function getStoresByCategory(req, res) {
  // 1) URL 파라미터를 우선, 없으면 쿼리스트링 사용
  const category = req.params.category || req.query.category || "";
  console.log("🛠️ getStoresByCategory called with category:", category);

  try {
    // 2) 실제 쿼리 전에 파라미터와 컬럼 매칭 확인
    //    (이름이 실제 테이블에 없으면 에러 납니다)
    const sql = `
      SELECT
        id,
        business_name AS "businessName",
        phone_number  AS "phone",
        image1        AS "thumbnailUrl"
      FROM store_info
      WHERE ($1 = '' OR business_category = $1)
    `;
    const { rows } = await pool.query(sql, [category]);
    console.log("🛠️ getStoresByCategory result:", rows.length, "rows");
    return res.json(rows);

  } catch (err) {
    // 3) 에러 로그 강화
    console.error("🔴 getStoresByCategory error:", err.message);
    console.error(err.stack);
    return res.status(500).json({ error: "서버 오류: " + err.message });
  }
}
