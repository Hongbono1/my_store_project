// controllers/ownerController.js
import pool from "../db.js";

/* ───────────────────────────────
 📊 사장님 대시보드 통계
─────────────────────────────── */
export async function getOwnerStats(req, res) {
    try {
        const storeId = parseInt(req.query.store_id, 10);
        if (!Number.isFinite(storeId))
            return res.status(400).json({ ok: false, error: "invalid_store_id" });

        const result = await pool.query(
            `
      SELECT 
        COUNT(DISTINCT o.id)       AS order_count,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS today_sales,
        COUNT(DISTINCT r.id)       AS reviews,
        120                        AS today_visitors,  -- 임시 더미
        45                         AS favorites         -- 임시 더미
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN reviews r ON r.store_id = o.store_id
      WHERE o.store_id = $1
        AND o.created_at::date = CURRENT_DATE;
      `,
            [storeId]
        );

        res.json({ ok: true, ...result.rows[0] });
    } catch (err) {
        console.error("[getOwnerStats] error:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/* ───────────────────────────────
 🧾 최근 주문 내역
─────────────────────────────── */
export async function getRecentOrders(req, res) {
    try {
        const storeId = parseInt(req.query.store_id, 10);
        if (!Number.isFinite(storeId))
            return res.status(400).json({ ok: false, error: "invalid_store_id" });

        const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);

        const { rows } = await pool.query(
            `
      SELECT
        o.id,
        o.created_at,
        o.status,
        COALESCE( (ARRAY_AGG(oi.menu_name ORDER BY oi.id))[1], '' ) AS first_menu,
        COALESCE( (ARRAY_AGG(oi.quantity   ORDER BY oi.id))[1], 1  ) AS first_qty,
        GREATEST(COUNT(oi.id) - 1, 0) AS other_count,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_price
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.store_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $2;
      `,
            [storeId, limit]
        );

        const data = rows.map(r => ({
            id: r.id,
            order_no: "#A" + String(r.id).padStart(5, "0"),
            menu_label:
                r.first_menu +
                (r.first_qty > 1 ? ` x${r.first_qty}` : "") +
                (r.other_count > 0 ? ` 외 ${r.other_count}개` : ""),
            total_price: Number(r.total_price),
            created_at: r.created_at,
            status: r.status,
        }));

        res.json({ ok: true, orders: data });
    } catch (err) {
        console.error("[getRecentOrders] error:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}
