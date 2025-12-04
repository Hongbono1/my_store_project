// controllers/indexmanagerAdController.js
import pool from "../db.js";
import path from "path";

/**
 * GET /manager/ad/slot
 * 쿼리: ?page=index&position=index_main_top
 */
export async function getSlot(req, res) {
  const { page, position } = req.query;

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page / position 파라미터가 필요합니다.",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        page,
        position,
        image_url,
        link_url,
        biz_number,
        biz_name,
        start_date,
        end_date,
        start_time,
        end_time,
        is_active
      FROM admin_ad_slots
      WHERE page = $1
        AND position = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [page, position]
    );

    if (!rows.length) {
      return res.json({ ok: true, slot: null });
    }

    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("GET SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "slot 조회 오류",
    });
  }
}

/**
 * GET /manager/ad/text/get
 * 쿼리: ?page=index&position=index_sub_keywords
 */
export async function getText(req, res) {
  const { page, position } = req.query;

  if (!page || !position) {
    return res.status(400).json({
      ok: false,
      message: "page / position 파라미터가 필요합니다.",
    });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT id, page, position, content
      FROM admin_ad_texts
      WHERE page = $1
        AND position = $2
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
      `,
      [page, position]
    );

    if (!rows.length) {
      return res.json({ ok: true, text: null });
    }

    return res.json({ ok: true, text: rows[0] });
  } catch (err) {
    console.error("GET TEXT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 조회 오류",
    });
  }
}

/**
 * POST /manager/ad/upload
 * FormData: page, position, link_url, start_date, end_date, start_time, end_time, image(파일)
 * indexmanager.html의 "이미지 + 링크 직접 입력" 모드
 */
export async function uploadSlot(req, res) {
  try {
    const {
      page,
      position,
      link_url = "",
      start_date = "",
      end_date = "",
      start_time = "",
      end_time = "",
    } = req.body;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page / position 값이 없습니다.",
      });
    }

    // 업로드된 파일 경로 -> /uploads/파일명
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // 기존 슬롯 삭제 후 새로 저장(단순 upsert)
    await pool.query(
      `DELETE FROM admin_ad_slots WHERE page = $1 AND position = $2`,
      [page, position]
    );

    await pool.query(
      `
      INSERT INTO admin_ad_slots (
        page,
        position,
        image_url,
        link_url,
        start_date,
        end_date,
        start_time,
        end_time,
        is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        NULLIF($4, ''),
        NULLIF($5, '')::date,
        NULLIF($6, '')::date,
        NULLIF($7, '')::time,
        NULLIF($8, '')::time,
        TRUE
      )
      `,
      [page, position, imageUrl, link_url, start_date, end_date, start_time, end_time]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("UPLOAD SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "slot 저장 오류",
    });
  }
}

/**
 * POST /manager/ad/store
 * JSON: { page, position, biz_number, biz_name, start_date, ... }
 * (지금은 가게 상세 링크를 아직 안 붙이고, 일단 번호/상호만 저장)
 */
export async function saveStoreSlot(req, res) {
  try {
    const {
      page,
      position,
      biz_number = "",
      biz_name = "",
      start_date = "",
      end_date = "",
      start_time = "",
      end_time = "",
    } = req.body;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page / position 값이 없습니다.",
      });
    }
    if (!biz_number || !biz_name) {
      return res.status(400).json({
        ok: false,
        message: "사업자번호와 상호명을 모두 입력해야 합니다.",
      });
    }

    // 일단 이미지/링크는 비워두고, 향후 가게 테이블과 연동해서 자동 세팅 예정
    await pool.query(
      `DELETE FROM admin_ad_slots WHERE page = $1 AND position = $2`,
      [page, position]
    );

    await pool.query(
      `
      INSERT INTO admin_ad_slots (
        page,
        position,
        biz_number,
        biz_name,
        start_date,
        end_date,
        start_time,
        end_time,
        is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        NULLIF($5, '')::date,
        NULLIF($6, '')::date,
        NULLIF($7, '')::time,
        NULLIF($8, '')::time,
        TRUE
      )
      `,
      [page, position, biz_number, biz_name, start_date, end_date, start_time, end_time]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("SAVE STORE SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "가게 슬롯 저장 오류",
    });
  }
}

/**
 * POST /manager/ad/text/save
 * JSON: { page, position, content }
 */
export async function saveText(req, res) {
  try {
    const { page, position, content } = req.body;

    if (!page || !position || !content) {
      return res.status(400).json({
        ok: false,
        message: "page / position / content 모두 필요합니다.",
      });
    }

    // 기존 텍스트 삭제 후 새로 저장
    await pool.query(
      `DELETE FROM admin_ad_texts WHERE page = $1 AND position = $2`,
      [page, position]
    );

    await pool.query(
      `
      INSERT INTO admin_ad_texts (page, position, content)
      VALUES ($1, $2, $3)
      `,
      [page, position, content]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("SAVE TEXT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 저장 오류",
    });
  }
}
