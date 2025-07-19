import express from "express";
const router = express.Router();

// [POST] /storepride/register
router.post("/register", async (req, res) => {
  try {
    // 실제 저장 로직(예시, DB 연동 등)
    // const { name, description } = req.body;
    // await pool.query("INSERT INTO store_pride ...", [...]);

    // 여기서는 일단 요청 데이터만 그대로 반환
    res.json({
      success: true,
      data: req.body,
      message: "스토어 프라이드 등록 완료"
    });
  } catch (err) {
    console.error("[스토어 프라이드 등록] 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
});

export default router;
