// controllers/inquiryBoardController.js
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// 📁 업로드 폴더 (실제 경로: public/uploads/inquiryBoard → URL: /uploads/inquiryBoard/...)
const uploadDir = path.join(process.cwd(), "public/uploads/inquiryBoard");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 문의 게시판 업로드 폴더 생성:", uploadDir);
} else {
    console.log("✅ 문의 게시판 업로드 폴더 존재:", uploadDir);
}

// 🔧 Multer 설정 (이미지 최대 3개, 5MB)
// ✅ inquiryregister.html 에서는 <input name="images" ...> 로 3개까지 보냄
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/data/uploads/inquiryBoard"); // ✅ A 방식 통일
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

export const uploadInquiryBoard = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype);

        if (extOk && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error("이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다."));
        }
    },
}).array("images", 3); // 🔥 중요: 필드 이름 "images"

// 🔍 inquiry 테이블 컬럼 정보 캐싱 (Neon DB 기준)
let cachedColumns = null;
let lastColumnsLoadedAt = 0;

async function getInquiryColumns() {
    const now = Date.now();
    if (!cachedColumns || now - lastColumnsLoadedAt > 5 * 60 * 1000) {
        const result = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'inquiry';"
        );
        cachedColumns = new Set(result.rows.map((r) => r.column_name));
        lastColumnsLoadedAt = now;
        console.log("🧾 inquiry 테이블 컬럼:", [...cachedColumns].join(", "));
    }
    return cachedColumns;
}

// 📨 문의 등록 (POST /api/inquiry, /api/inquiryBoard)
export const createInquiryBoard = async (req, res) => {
    try {
        const { title, content, user_name, user_phone } = req.body || {};

        // 필수값 체크
        if (!title || !content || !user_name) {
            return res.status(400).json({
                ok: false,
                success: false,
                error: "제목, 내용, 이름은 필수 입력사항입니다.",
            });
        }

        // 업로드된 파일 경로 (URL 기준)
        const filePaths =
            req.files?.map((file) => `/uploads/inquiryBoard/${file.filename}`) || [];
        console.log("📁 업로드된 문의 이미지:", filePaths);

        const columnsSet = await getInquiryColumns();

        const insertColumns = [];
        const values = [];
        const params = [];

        // 🔹 실제 존재하는 컬럼만 INSERT
        if (columnsSet.has("title")) {
            insertColumns.push("title");
            values.push(title.trim());
            params.push(`$${params.length + 1}`);
        }
        if (columnsSet.has("content")) {
            insertColumns.push("content");
            values.push(content.trim());
            params.push(`$${params.length + 1}`);
        }
        if (columnsSet.has("user_name")) {
            insertColumns.push("user_name");
            values.push(user_name.trim());
            params.push(`$${params.length + 1}`);
        }
        if (columnsSet.has("user_phone")) {
            insertColumns.push("user_phone");
            values.push(user_phone ? user_phone.trim() : null);
            params.push(`$${params.length + 1}`);
        }
        if (columnsSet.has("file_paths")) {
            insertColumns.push("file_paths");
            values.push(JSON.stringify(filePaths));
            params.push(`$${params.length + 1}`);
        }
        if (columnsSet.has("created_at")) {
            insertColumns.push("created_at");
            values.push(new Date());
            params.push(`$${params.length + 1}`);
        }

        if (insertColumns.length === 0) {
            console.error("❌ inquiry 테이블에 쓸 수 있는 컬럼이 없습니다.");
            return res.status(500).json({
                ok: false,
                success: false,
                error: "inquiry 테이블 구조가 예상과 다릅니다.",
            });
        }

        const returningCols = ["id"];
        if (columnsSet.has("created_at")) {
            returningCols.push("created_at");
        }

        const sql = `
      INSERT INTO inquiry (${insertColumns.join(", ")})
      VALUES (${params.join(", ")})
      RETURNING ${returningCols.join(", ")}
    `;

        const result = await pool.query(sql, values);
        const row = result.rows[0];
        const createdAt = row.created_at || new Date();

        return res.json({
            ok: true,
            success: true,
            id: row.id,
            data: {
                id: row.id,
                created_at: createdAt,
                uploaded_files: filePaths.length,
            },
        });
    } catch (err) {
        console.error("❌ 문의 등록 오류:", err);
        return res.status(500).json({
            ok: false,
            success: false,
            error: "서버 오류가 발생했습니다.",
        });
    }
};

// 📋 문의 목록 조회 (GET /api/inquiryBoard)
export const getInquiryBoardList = async (req, res) => {
    try {
        const columnsSet = await getInquiryColumns();

        const selectCols = ["id"];
        if (columnsSet.has("title")) selectCols.push("title");
        if (columnsSet.has("user_name")) selectCols.push("user_name");
        if (columnsSet.has("created_at")) selectCols.push("created_at");
        if (columnsSet.has("answer")) selectCols.push("answer");
        if (columnsSet.has("file_paths")) selectCols.push("file_paths");

        const sql = `
      SELECT ${selectCols.join(", ")}
      FROM inquiry
      ORDER BY id DESC
      LIMIT 50
    `;

        const dbResult = await pool.query(sql);

        const list = dbResult.rows.map((row) => {
            const hasAnswer =
                "answer" in row && row.answer && row.answer.toString().trim() !== "";

            let fileCount = 0;
            if ("file_paths" in row && row.file_paths) {
                try {
                    const parsed =
                        typeof row.file_paths === "string"
                            ? JSON.parse(row.file_paths)
                            : row.file_paths;
                    if (Array.isArray(parsed)) {
                        fileCount = parsed.length;
                    }
                } catch (e) {
                    console.warn("⚠️ file_paths 파싱 실패:", e.message);
                }
            }

            return {
                id: row.id,
                title: row.title || "",
                user_name: row.user_name || "",
                created_at: row.created_at || null,
                has_answer: hasAnswer,
                file_count: fileCount,
            };
        });

        console.log(`📋 문의 목록 조회: ${list.length}건`);
        return res.json(list);
    } catch (err) {
        console.error("❌ 문의 목록 조회 오류:", err);
        return res.status(500).json({
            ok: false,
            success: false,
            error: "서버 오류가 발생했습니다.",
        });
    }
};

// 📄 문의 상세 조회 (GET /api/inquiryBoard/:id)
export const getInquiryBoardDetail = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({
                ok: false,
                success: false,
                error: "유효하지 않은 문의 ID입니다.",
            });
        }

        const columnsSet = await getInquiryColumns();
        const selectCols = ["id"];

        const candidateCols = [
            "title",
            "content",
            "user_name",
            "user_phone",
            "file_paths",
            "answer",
            "created_at",
            "updated_at",
        ];
        candidateCols.forEach((c) => {
            if (columnsSet.has(c)) selectCols.push(c);
        });

        const sql = `
      SELECT ${selectCols.join(", ")}
      FROM inquiry
      WHERE id = $1
      LIMIT 1
    `;

        const result = await pool.query(sql, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                ok: false,
                success: false,
                error: "문의를 찾을 수 없습니다.",
            });
        }

        const inquiry = result.rows[0];

        if ("file_paths" in inquiry && inquiry.file_paths) {
            try {
                inquiry.file_paths =
                    typeof inquiry.file_paths === "string"
                        ? JSON.parse(inquiry.file_paths)
                        : inquiry.file_paths;
                if (!Array.isArray(inquiry.file_paths)) {
                    inquiry.file_paths = [];
                }
            } catch (e) {
                console.warn("⚠️ file_paths JSON 파싱 오류:", e.message);
                inquiry.file_paths = [];
            }
        } else {
            inquiry.file_paths = [];
        }

        console.log(
            `📋 문의 상세 조회: ID ${id}, 첨부파일 ${inquiry.file_paths.length}개`
        );
        return res.json({
            ok: true,
            success: true,
            data: inquiry,
        });
    } catch (err) {
        console.error("❌ 문의 상세 조회 오류:", err);
        return res.status(500).json({
            ok: false,
            success: false,
            error: "서버 오류가 발생했습니다.",
        });
    }
};
