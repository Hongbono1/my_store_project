// controllers/hotplaceController.js
import pool from "../db.js";

/**
 * 공통 upsert 유틸
 * field: "click_count" | "bookmark_count" | "search_count"
 */
async function upsertHotplaceStat(storeId, field) {
    const allowed = ["click_count", "bookmark_count", "search_count"];
    if (!allowed.includes(field)) {
        throw new Error("INVALID_FIELD");
    }

    const sql = `
    INSERT INTO hotplace_stats (store_id, ${field})
    VALUES ($1, 1)
    ON CONFLICT (store_id)
    DO UPDATE SET
      ${field} = hotplace_stats.${field} + 1,
      updated_at = now()
    RETURNING *;
  `;

    const { rows } = await pool.query(sql, [storeId]);
    return rows[0];
}

/** 🔥 클릭 +1 */
export async function addHotplaceClick(req, res) {
    try {
        const { storeId } = req.body;
        if (!storeId) {
            return res.status(400).json({ ok: false, error: "missing_store_id" });
        }

        const stat = await upsertHotplaceStat(storeId, "click_count");
        res.json({ ok: true, stat });
    } catch (err) {
        console.error("HOTPLACE CLICK ERROR:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/** ⭐ 북마크 +1 */
export async function addHotplaceBookmark(req, res) {
    try {
        const { storeId } = req.body;
        if (!storeId) {
            return res.status(400).json({ ok: false, error: "missing_store_id" });
        }

        const stat = await upsertHotplaceStat(storeId, "bookmark_count");
        res.json({ ok: true, stat });
    } catch (err) {
        console.error("HOTPLACE BOOKMARK ERROR:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/** 🔍 검색 선택 +1 */
export async function addHotplaceSearch(req, res) {
    try {
        const { storeId } = req.body;
        if (!storeId) {
            return res.status(400).json({ ok: false, error: "missing_store_id" });
        }

        const stat = await upsertHotplaceStat(storeId, "search_count");
        res.json({ ok: true, stat });
    } catch (err) {
        console.error("HOTPLACE SEARCH ERROR:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/** 🏆 Top4 Hot Place 가져오기 */
export async function getTopHotplaces(req, res) {
    try {
        const { rows } = await pool.query(`
      SELECT
        s.*,
        h.click_count,
        h.bookmark_count,
        h.search_count,
        (h.click_count + h.bookmark_count + h.search_count) AS hot_score
      FROM combined_store_info AS s            -- 🔴 실제 가게 테이블 이름으로 변경!
      JOIN hotplace_stats AS h ON h.store_id = s.id  -- 🔴 PK 컬럼명도 맞게 수정
      ORDER BY hot_score DESC, h.updated_at DESC
      LIMIT 4;
    `);

        res.json(rows);
    } catch (err) {
        console.error("HOTPLACE TOP4 ERROR:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}
