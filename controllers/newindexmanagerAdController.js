// controllers/newindexmanagerAdController.js
import pool from "../db.js";

// 문자열 정리
function s(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

// page, position 검증
function validatePagePosition(page, position) {
  const p = s(page);
  const pos = s(position);
  if (!p || !pos) {
    throw new Error("page와 position은 필수입니다.");
  }
  return { page: p, position: pos };
}

/**
 * GET /manager/newindex/slot?page=index&position=index_main_top
 * → 특정 슬롯 1개 조회
 */
export async function getNewIndexSlot(req, res) {
  try {
    const { page, position } = validatePagePosition(
      req.query.page,
      req.query.position
    );

    const sql = `
      SELECT
        id,
        page,
        position,
        priority,
        image_url,
        link_url,
        text_content,
        start_at,
        end_at,
        no_end,
        created_at,
        updated_at
      FROM public.admin_ad_slots
      WHERE page = $1
        AND position = $2
      ORDER BY priority ASC, id ASC
      LIMIT 1
    `;
    const params = [page, position];

    const { rows } = await pool.query(sql, params);
    const slot = rows[0] || null;

    return res.json({
      success: true,
      slot,
    });
  } catch (err) {
    console.error("[getNewIndexSlot] 오류:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "slot 조회 중 오류가 발생했습니다.",
    });
  }
}

/**
 * GET /manager/newindex/slots?page=index
 * → 해당 page의 슬롯 목록 (newindexmanager 전용)
 */
export async function listNewIndexSlots(req, res) {
  try {
    const page = s(req.query.page || "index");

    const sql = `
      SELECT
        id,
        page,
        position,
        priority,
        image_url,
        link_url,
        text_content,
        start_at,
        end_at,
        no_end,
        created_at,
        updated_at
      FROM public.admin_ad_slots
      WHERE page = $1
      ORDER BY position ASC, priority ASC, id ASC
    `;
    const { rows } = await pool.query(sql, [page]);

    return res.json({
      success: true,
      page,
      slots: rows,
    });
  } catch (err) {
    console.error("[listNewIndexSlots] 오류:", err);
    return res.status(500).json({
      success: false,
      error: "slot 목록 조회 중 오류가 발생했습니다.",
    });
  }
}

/**
 * POST /manager/newindex/slot
 * JSON body:
 * {
 *   "page": "index",
 *   "position": "index_main_top",
 *   "image_url": "/uploads/xxx.jpg",
 *   "link_url": "/ndetail.html?id=1&type=store_info",
 *   "text_content": "텍스트 내용"
 * }
 *
 * → page+position+priority=1 기준으로 UPSERT
 */
export async function upsertNewIndexSlot(req, res) {
  const client = await pool.connect();
  try {
    const { page, position, image_url, link_url, text_content } = req.body || {};
    const { page: p, position: pos } = validatePagePosition(page, position);

    const img = s(image_url);
    const link = s(link_url);
    const text = s(text_content);

    await client.query("BEGIN");

    // 존재 여부 확인 (priority = 1)
    const selectSql = `
      SELECT id
      FROM public.admin_ad_slots
      WHERE page = $1
        AND position = $2
        AND priority = 1
      ORDER BY id ASC
      LIMIT 1
    `;
    const selectParams = [p, pos];
    const selectResult = await client.query(selectSql, selectParams);

    if (selectResult.rowCount > 0) {
      // UPDATE
      const id = selectResult.rows[0].id;
      const updateSql = `
        UPDATE public.admin_ad_slots
        SET
          image_url   = $1,
          link_url    = $2,
          text_content = $3,
          updated_at  = NOW()
        WHERE id = $4
      `;
      const updateParams = [img || null, link || null, text || null, id];
      await client.query(updateSql, updateParams);
    } else {
      // INSERT (priority = 1)
      const insertSql = `
        INSERT INTO public.admin_ad_slots
          (page, position, priority, image_url, link_url, text_content,
           start_at, end_at, no_end, created_at, updated_at)
        VALUES
          ($1,   $2,       1,        $3,        $4,       $5,
           NOW(), NULL,   TRUE,     NOW(),     NOW())
        RETURNING id
      `;
      const insertParams = [p, pos, img || null, link || null, text || null];
      await client.query(insertSql, insertParams);
    }

    await client.query("COMMIT");

    const { rows } = await client.query(
      `
      SELECT
        id,
        page,
        position,
        priority,
        image_url,
        link_url,
        text_content,
        start_at,
        end_at,
        no_end,
        created_at,
        updated_at
      FROM public.admin_ad_slots
      WHERE page = $1
        AND position = $2
        AND priority = 1
      ORDER BY id ASC
      LIMIT 1
      `,
      [p, pos]
    );

    return res.json({
      success: true,
      slot: rows[0] || null,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[upsertNewIndexSlot] 오류:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "slot 저장 중 오류가 발생했습니다.",
    });
  } finally {
    client.release();
  }
}
