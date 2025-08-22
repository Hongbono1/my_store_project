// ncombinedregisterController.js
// 여기서는 DB 저장 대신 요청 데이터를 콘솔에 찍고 응답만 돌려주는 예시입니다.
// 실제 DB 연동은 pool.query(...) 등으로 교체하면 됩니다.

export async function createCombinedStore(req, res) {
  try {
    console.log("📥 [ncombinedregister] body:", req.body);
    console.log("📸 [ncombinedregister] files:", req.files);

    // TODO: DB 저장 로직 (store_info, owner_info, 메뉴 등)
    // 예: const { ownerName, businessName } = req.body;

    res.json({ ok: true, message: "등록이 완료되었습니다!" });
  } catch (err) {
    console.error("❌ createCombinedStore error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
