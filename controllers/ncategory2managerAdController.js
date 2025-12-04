// controllers/ncategory2managerAdController.js
import pool from "../db.js";

/**
 * 🔹 공통: page + position으로 하나만 유지하기 위한 upsert 쿼리
 *  - admin_ad_slots 에 (page, position) UNIQUE 인덱스가 있다고 가정
 *    CREATE UNIQUE INDEX admin_ad_slots_page_position_idx
 *      ON admin_ad_slots(page, position);
 *
 *  - 추천 테이블 구조 예시:
 *    CREATE TABLE admin_ad_slots (
 *      id          BIGSERIAL PRIMARY KEY,
 *      page        TEXT NOT NULL,
 *      position    TEXT NOT NULL,
 *      slot_type   TEXT NOT NULL, -- 'image' | 'store' | 'text'
 *      image_path  TEXT,
 *      link_url    TEXT,
 *      biz_number  TEXT,
 *      biz_name    TEXT,
 *      content     TEXT,
 *      start_date  DATE,
 *      end_date    DATE,
 *      start_time  TIME,
 *      end_time    TIME,
 *      created_at  TIMESTAMPTZ DEFAULT now(),
 *      updated_at  TIMESTAMPTZ DEFAULT now()
 *    );
 */

function toNull(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    return v;
}

/** 🟦 이미지 + 링크 슬롯 저장 (업로드 포함) */
export async function saveImageSlot(req, res) {
    const {
        page,
        position,
        link_url,
        start_date,
        end_date,
        start_time,
        end_time,
    } = req.body || {};

    if (!page || !position) {
        return res.status(400).json({ ok: false, message: "page, position은 필수입니다." });
    }

    // 업로드 된 파일이 있다면 /uploads/파일명 으로 저장
    let image_path = null;
    if (req.file) {
        image_path = `/uploads/${req.file.filename}`;
    }

    try {
        const result = await pool.query(
            `
      INSERT INTO admin_ad_slots (
        page, position, slot_type,
        image_path, link_url,
        start_date, end_date, start_time, end_time
      )
      VALUES (
        $1, $2, 'image',
        $3, $4,
        $5, $6, $7, $8
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type   = EXCLUDED.slot_type,
        image_path  = EXCLUDED.image_path,
        link_url    = EXCLUDED.link_url,
        start_date  = EXCLUDED.start_date,
        end_date    = EXCLUDED.end_date,
        start_time  = EXCLUDED.start_time,
        end_time    = EXCLUDED.end_time,
        updated_at  = now()
      RETURNING *
      `,
            [
                page,
                position,
                toNull(image_path),
                toNull(link_url),
                toNull(start_date),
                toNull(end_date),
                toNull(start_time),
                toNull(end_time),
            ]
        );

        return res.json({
            ok: true,
            slot: result.rows[0],
        });
    } catch (err) {
        console.error("saveImageSlot ERROR:", err);
        return res.status(500).json({
            ok: false,
            message: "이미지 슬롯 저장 중 오류가 발생했습니다.",
        });
    }
}

/** 🟩 등록된 가게 연결 슬롯 (사업자번호 + 상호) */
export async function saveStoreSlot(req, res) {
    const {
        page,
        position,
        biz_number,
        biz_name,
        start_date,
        end_date,
        start_time,
        end_time,
    } = req.body || {};

    if (!page || !position) {
        return res.status(400).json({ ok: false, message: "page, position은 필수입니다." });
    }
    if (!biz_number || !biz_name) {
        return res.status(400).json({ ok: false, message: "사업자번호와 상호를 모두 입력해주세요." });
    }

    try {
        const result = await pool.query(
            `
      INSERT INTO admin_ad_slots (
        page, position, slot_type,
        biz_number, biz_name,
        start_date, end_date, start_time, end_time
      )
      VALUES (
        $1, $2, 'store',
        $3, $4,
        $5, $6, $7, $8
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type   = EXCLUDED.slot_type,
        biz_number  = EXCLUDED.biz_number,
        biz_name    = EXCLUDED.biz_name,
        start_date  = EXCLUDED.start_date,
        end_date    = EXCLUDED.end_date,
        start_time  = EXCLUDED.start_time,
        end_time    = EXCLUDED.end_time,
        updated_at  = now()
      RETURNING *
      `,
            [
                page,
                position,
                biz_number,
                biz_name,
                toNull(start_date),
                toNull(end_date),
                toNull(start_time),
                toNull(end_time),
            ]
        );

        return res.json({
            ok: true,
            slot: result.rows[0],
        });
    } catch (err) {
        console.error("saveStoreSlot ERROR:", err);
        return res.status(500).json({
            ok: false,
            message: "가게 슬롯 저장 중 오류가 발생했습니다.",
        });
    }
}

/** 🟨 텍스트 슬롯 저장 */
export async function saveTextSlot(req, res) {
    const {
        page,
        position,
        content,
        start_date,
        end_date,
        start_time,
        end_time,
    } = req.body || {};

    if (!page || !position) {
        return res.status(400).json({ ok: false, message: "page, position은 필수입니다." });
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ ok: false, message: "content(텍스트)는 필수입니다." });
    }

    try {
        const result = await pool.query(
            `
      INSERT INTO admin_ad_slots (
        page, position, slot_type,
        content,
        start_date, end_date, start_time, end_time
      )
      VALUES (
        $1, $2, 'text',
        $3,
        $4, $5, $6, $7
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type   = EXCLUDED.slot_type,
        content     = EXCLUDED.content,
        start_date  = EXCLUDED.start_date,
        end_date    = EXCLUDED.end_date,
        start_time  = EXCLUDED.start_time,
        end_time    = EXCLUDED.end_time,
        updated_at  = now()
      RETURNING *
      `,
            [
                page,
                position,
                content,
                toNull(start_date),
                toNull(end_date),
                toNull(start_time),
                toNull(end_time),
            ]
        );

        return res.json({
            ok: true,
            slot: result.rows[0],
        });
    } catch (err) {
        console.error("saveTextSlot ERROR:", err);
        return res.status(500).json({
            ok: false,
            message: "텍스트 슬롯 저장 중 오류가 발생했습니다.",
        });
    }
}

/** (선택) 특정 page용 슬롯 전체 조회: 나중에 ndetail에서 불러올 때 활용 가능 */
export async function getSlotsByPage(req, res) {
    const { page } = req.query;
    const targetPage = page || "ncategory2manager";

    try {
        const result = await pool.query(
            `
      SELECT *
      FROM admin_ad_slots
      WHERE page = $1
      ORDER BY position ASC, id ASC
      `,
            [targetPage]
        );

        return res.json({
            ok: true,
            page: targetPage,
            slots: result.rows,
        });
    } catch (err) {
        console.error("getSlotsByPage ERROR:", err);
        return res.status(500).json({
            ok: false,
            message: "슬롯 목록 조회 중 오류가 발생했습니다.",
        });
    }
}
