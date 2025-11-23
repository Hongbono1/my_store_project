import pool from "../config/db.js";

// 문의 등록
export const createInquiry = async (req, res) => {
    try {
        const { title, user_name, user_phone, content } = req.body;

        const sql = `
            INSERT INTO inquiry (title, user_name, user_phone, content)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;

        const result = await pool.query(sql, [
            title,
            user_name,
            user_phone || null,
            content
        ]);

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("❌ createInquiry error:", err);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// 문의 목록
export const getInquiryList = async (req, res) => {
    try {
        const sql = `
            SELECT id, title, user_name, created_at
            FROM inquiry
            ORDER BY id DESC
        `;

        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ getInquiryList error:", err);
        res.status(500).json({ error: "Server Error" });
    }
};

// 문의 상세
export const getInquiryDetail = async (req, res) => {
    const { id } = req.params;

    try {
        const sql = `SELECT * FROM inquiry WHERE id = $1`;
        const result = await pool.query(sql, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Not Found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ getInquiryDetail error:", err);
        res.status(500).json({ error: "Server Error" });
    }
};
