import fetch from "node-fetch";

/* POST /verify-biz */
export async function verifyBiz(req, res) {
  try {
    const { b_no } = req.body;
    const list     = Array.isArray(b_no) ? b_no : [b_no];
    const url      = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${process.env.BIZ_API_KEY}`;

    const r  = await fetch(url, {
      method : "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json;charset=UTF-8",
      },
      body   : JSON.stringify({ b_no: list }),
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("❌ verifyBiz", err);
    res.status(500).json({ message: "서버 오류" });
  }
}

/* GET /kakao-key */
export function getKakaoKey(_req, res) {
  res.json({ key: process.env.KAKAO_MAP_KEY });
}
