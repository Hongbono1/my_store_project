import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        business_name as name,
        category,
        main_image as image,
        'food' as type
      FROM food_stores
      WHERE is_best_pick = true
      ORDER BY created_at DESC
      LIMIT 18
    `);

    // ✅ 올바른 링크 생성
    const stores = rows.map(store => ({
      id: store.id,
      name: store.name,
      category: store.category || "기타",
      image: store.image || "/uploads/no-image.png",
      type: store.type,
      // ✅ 정확한 경로로 링크 생성
      link: `/ndetail.html?id=${store.id}&type=${store.type}`
    }));

    return res.json(stores);
  } catch (err) {
    console.error("BEST PICK ERROR:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Best Pick 조회 실패" 
    });
  }
});

export default router;
