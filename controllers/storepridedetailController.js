import pool from "../db.js"; // 실제 사용하는 db 연결 모듈 이름에 맞게 수정

export async function getStorePrideDetail(req, res) {
    const id = Number(req.params.id);
    if (!id) {
        return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    try {
        const eventSql = `
      SELECT
        e.id,
        e.store_id,
        e.title,
        e.event_date,
        e.category,
        e.phone,
        e.address,
        e.content,
        e.image_path,
        e.created_at
      FROM store_events e
      WHERE e.id = $1
      LIMIT 1
    `;
        const eventResult = await pool.query(eventSql, [id]);

        if (eventResult.rowCount === 0) {
            return res.status(404).json({ ok: false, error: "not_found" });
        }

        const event = eventResult.rows[0];

        // 가게 기본 정보도 같이 가져오기 (store_info join)
        const storeSql = `
      SELECT
        id,
        business_name,
        business_type,
        business_category
      FROM store_info
      WHERE id = $1
      LIMIT 1
    `;
        const storeResult = await pool.query(storeSql, [event.store_id]);
        const store = storeResult.rowCount ? storeResult.rows[0] : null;

        return res.json({
            ok: true,
            data: {
                ...event,
                store,
            },
        });
    } catch (e) {
        console.error("getStorePrideDetail ERROR:", e);
        return res.status(500).json({ ok: false, error: "server_error" });
    }
}