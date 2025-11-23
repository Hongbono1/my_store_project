// controllers/inquiryController.js
import pool from "../config/db.js";
import multer from "multer";
import path from "path";

// 업로드 설정
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "public/uploads/inquiry");
    },
    filename(req, file, cb) {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
export const uploadInquiry = multer({ storage });

// 문의 등록
export const registerInquiry = async (req, res) => {
    try {
        const {
            primary_category,
            secondary_category,
            title,
            content,
            email,
            phone
        } = req.body;

        const file_path = req.file ? `/uploads/inquiry/${req.file.filename}` : null;

        await pool.query(
            `INSERT INTO inquiry 
            (primary_category, secondary_category, title, content, email, phone, file_path)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [primary_category, secondary_category, title, content, email, phone, file_path]
        );

        return res.json({ success: true });

    } catch (error) {
        console.error("문의 등록 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류" });
    }
};

// 전체 목록
export const getInquiryList = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, primary_category, title, created_at 
             FROM inquiry ORDER BY id DESC`
        );
        res.json({ success: true, list: result.rows });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// 상세페이지
export const getInquiryDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM inquiry WHERE id=$1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "문의 없음" });
        }

        res.json({ success: true, detail: result.rows[0] });

    } catch (error) {
        res.status(500).json({ success: false });
    }
};
