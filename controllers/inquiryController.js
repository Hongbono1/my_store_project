// controllers/inquiryController.js
import pool from "../db.js";

// ⭐ 문의 등록 (파일 없음, JSON만 처리)
export const createInquiry = async (req, res) => {
    try {
        const { title, content, user_name, user_phone } = req.body;

        // 필수값 체크
        if (!title || !content || !user_name) {
            return res.status(400).json({
                success: false,
                error: "필수값 누락"
            });
        }

        // DB 저장
        const result = await pool.query(
            `INSERT INTO inquiry (title, content, user_name, user_phone)
             VALUES ($1, $2, $3, $4)
             RETURNING id, created_at`,
            [title, content, user_name, user_phone || null]
        );

        return res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("❌ createInquiry 오류:", error);
        return res.status(500).json({
            success: false,
            error: "SERVER_ERROR"
        });
    }
};

// ⭐ 문의 목록 조회
export const getInquiryList = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, title, user_name, created_at
            FROM inquiry
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            list: result.rows
        });

    } catch (error) {
        console.error("❌ getInquiryList 오류:", error);
        res.status(500).json({ success: false });
    }
};

// ⭐ 문의 상세 조회
export const getInquiryDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM inquiry WHERE id=$1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "NOT_FOUND"
            });
        }

        res.json({
            success: true,
            detail: result.rows[0]
        });

    } catch (error) {
        console.error("❌ getInquiryDetail 오류:", error);
        res.status(500).json({ success: false });
    }
};
