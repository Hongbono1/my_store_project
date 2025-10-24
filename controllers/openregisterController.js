// controllers/openregisterController.js
import pool from "../db.js";
import path from "path";

/* =========================================================
   1️⃣ 오픈예정 등록 (POST /openregister)
========================================================= */
export async function createOpenRegister(req, res) {
    try {
        const {
            store_name,
            open_date,
            category,
            phone,
            description,
            address,
            lat,
            lng,
        } = req.body;

        // 필수값 검사
        if (!store_name || !open_date || !phone) {
            return res.json({ success: false, error: "필수 항목 누락" });
        }

        // 이미지 경로 (선택)
        let image_path = null;
        if (req.file) {
            image_path = `/uploads/${path.basename(req.file.path)}`;
        }

        // DB 저장
        const result = await pool.query(
            `
      INSERT INTO open_stores 
      (store_name, open_date, category, phone, description, address, lat, lng, image_path, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      RETURNING id;
      `,
            [store_name, open_date, category, phone, description, address, lat, lng, image_path]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("❌ [createOpenRegister] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

/* =========================================================
   2️⃣ 전체 조회 (GET /openregister)
========================================================= */
export async function getOpenRegisters(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT id, store_name, open_date, category, phone, description, address, lat, lng, image_path
      FROM open_stores
      ORDER BY id DESC;
      `
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("❌ [getOpenRegisters] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

/* =========================================================
   3️⃣ 단일 조회 (GET /openregister/:id)
========================================================= */
export async function getOpenRegisterById(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `
      SELECT id, store_name, open_date, category, phone, description, address, lat, lng, image_path
      FROM open_stores
      WHERE id=$1;
      `,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: "데이터 없음" });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("❌ [getOpenRegisterById] Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
