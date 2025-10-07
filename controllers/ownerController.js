import pool from "../db.js";

/* =========================================================
   📊 1. 대시보드 메인 요약 (오늘 방문자, 즐겨찾기, 매출 등)
   ========================================================= */
export async function getOwnerDashboard(req, res) {
    const { store_id } = req.query;
    if (!store_id) return res.status(400).json({ ok: false, error: "store_id 누락" });

    try {
        const result = await pool.query(
            `
      SELECT
        (SELECT visitors FROM traffic_daily WHERE store_id=$1 AND day_kr=CURRENT_DATE) AS today_visitors,
        (SELECT COUNT(*) FROM favorites WHERE store_id=$1) AS favorites,
        (SELECT COUNT(*) FROM reviews WHERE store_id=$1) AS reviews,
        (SELECT COUNT(*) FROM orders WHERE store_id=$1 AND DATE(ordered_at)=CURRENT_DATE) AS order_count,
        (SELECT COALESCE(SUM(amount),0) FROM orders WHERE store_id=$1 AND DATE(ordered_at)=CURRENT_DATE) AS today_sales
      `,
            [store_id]
        );

        res.json({ ok: true, ...result.rows[0] });
    } catch (err) {
        console.error("[getOwnerDashboard]", err);
        res.status(500).json({ ok: false, error: "DB 조회 오류" });
    }
}

/* =========================================================
   📈 2. 기간별 통계 (일간 / 주간 / 월간 / 분기 / 반기 / 연간)
   ========================================================= */
export async function getOwnerStats(req, res) {
    const { store_id, period } = req.query;
    if (!store_id || !period)
        return res.status(400).json({ ok: false, error: "store_id 또는 period 누락" });

    try {
        let labelExpr = "";
        switch (period) {
            case "daily": labelExpr = "to_char(ordered_at, 'YYYY-MM-DD')"; break;
            case "weekly": labelExpr = "to_char(date_trunc('week', ordered_at), 'IYYY-IW')"; break;
            case "monthly": labelExpr = "to_char(ordered_at, 'YYYY-MM')"; break;
            case "quarterly": labelExpr = "concat('Q', extract(quarter from ordered_at))"; break;
            case "half": labelExpr = "CASE WHEN extract(month from ordered_at) <= 6 THEN '상반기' ELSE '하반기' END"; break;
            case "yearly": labelExpr = "to_char(ordered_at, 'YYYY')"; break;
            default: return res.status(400).json({ ok: false, error: "잘못된 기간값" });
        }

        const result = await pool.query(
            `
      SELECT ${labelExpr} AS label,
             COUNT(*) AS order_count,
             COALESCE(SUM(amount),0) AS total_sales
      FROM orders
      WHERE store_id=$1
      GROUP BY label
      ORDER BY label
      `,
            [store_id]
        );

        res.json({ ok: true, data: result.rows });
    } catch (err) {
        console.error("[getOwnerStats]", err);
        res.status(500).json({ ok: false, error: "DB 조회 오류" });
    }
}

/* =========================================================
   🧾 3. 최근 주문 내역
   ========================================================= */
export async function getRecentOrders(req, res) {
    const { store_id } = req.query;
    if (!store_id) return res.status(400).json({ ok: false, error: "store_id 누락" });

    try {
        const result = await pool.query(
            `
      SELECT id, amount, status, to_char(ordered_at, 'YYYY-MM-DD HH24:MI') AS ordered_at
      FROM orders
      WHERE store_id=$1
      ORDER BY ordered_at DESC
      LIMIT 10
      `,
            [store_id]
        );
        res.json({ ok: true, orders: result.rows });
    } catch (err) {
        console.error("[getRecentOrders]", err);
        res.status(500).json({ ok: false, error: "DB 조회 오류" });
    }
}

/* =========================================================
   🏪 4. 가게 정보 (조회 / 수정)
   ========================================================= */
export async function getStoreInfo(req, res) {
    const { store_id } = req.query;
    if (!store_id) return res.status(400).json({ ok: false, error: "store_id 누락" });

    try {
        const result = await pool.query(`SELECT * FROM store_info WHERE id=$1`, [store_id]);
        res.json({ ok: true, store: result.rows[0] || null });
    } catch (err) {
        console.error("[getStoreInfo]", err);
        res.status(500).json({ ok: false, error: "DB 조회 오류" });
    }
}

export async function updateStoreInfo(req, res) {
    const { store_id, address, open_hours, description } = req.body;
    if (!store_id) return res.status(400).json({ ok: false, error: "store_id 누락" });

    try {
        await pool.query(
            `
      UPDATE store_info
      SET address=$2, open_hours=$3, description=$4, updated_at=NOW()
      WHERE id=$1
      `,
            [store_id, address, open_hours, description]
        );
        res.json({ ok: true, message: "가게 정보 수정 완료" });
    } catch (err) {
        console.error("[updateStoreInfo]", err);
        res.status(500).json({ ok: false, error: "DB 수정 오류" });
    }
}

/* =========================================================
   🍜 5. 메뉴 관리 (조회 / 추가 / 수정 / 삭제)
   ========================================================= */
export async function getMenuList(req, res) {
    const { store_id } = req.query;
    if (!store_id) return res.status(400).json({ ok: false, error: "store_id 누락" });

    try {
        const result = await pool.query(
            `SELECT id, category, name, price, description FROM menu_items WHERE store_id=$1 ORDER BY id`,
            [store_id]
        );
        res.json({ ok: true, menus: result.rows });
    } catch (err) {
        console.error("[getMenuList]", err);
        res.status(500).json({ ok: false, error: "DB 조회 오류" });
    }
}

export async function addMenu(req, res) {
    const { store_id, category, name, price, description } = req.body;
    if (!store_id || !name) return res.status(400).json({ ok: false, error: "필수값 누락" });

    try {
        await pool.query(
            `INSERT INTO menu_items (store_id, category, name, price, description) VALUES ($1,$2,$3,$4,$5)`,
            [store_id, category, name, price, description]
        );
        res.json({ ok: true, message: "메뉴 추가 완료" });
    } catch (err) {
        console.error("[addMenu]", err);
        res.status(500).json({ ok: false, error: "DB 삽입 오류" });
    }
}

export async function updateMenu(req, res) {
    const { id, category, name, price, description } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "메뉴 id 누락" });

    try {
        await pool.query(
            `UPDATE menu_items SET category=$2, name=$3, price=$4, description=$5 WHERE id=$1`,
            [id, category, name, price, description]
        );
        res.json({ ok: true, message: "메뉴 수정 완료" });
    } catch (err) {
        console.error("[updateMenu]", err);
        res.status(500).json({ ok: false, error: "DB 수정 오류" });
    }
}

export async function deleteMenu(req, res) {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, error: "메뉴 id 누락" });

    try {
        await pool.query(`DELETE FROM menu_items WHERE id=$1`, [id]);
        res.json({ ok: true, message: "메뉴 삭제 완료" });
    } catch (err) {
        console.error("[deleteMenu]", err);
        res.status(500).json({ ok: false, error: "DB 삭제 오류" });
    }
}
