import pool from "../db.js";

/* -----------------------------
   1) 글 생성 (+ 이미지 업로드)
--------------------------------*/
export const createPost = async (req, res) => {
    try {
        const { region, category, title, content, writer } = req.body;

        const sql =
            "INSERT INTO local_board_posts(region, category, title, content, writer) VALUES($1,$2,$3,$4,$5) RETURNING id";

        const result = await pool.query(sql, [
            region,
            category,
            title,
            content,
            writer,
        ]);

        const postId = result.rows[0].id;

        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                await pool.query(
                    "INSERT INTO local_board_images(post_id, image_url) VALUES($1, $2)",
                    [postId, `/uploads/${file.filename}`]
                );
            }
        }

        res.json({ success: true, id: postId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

/* -----------------------------
   2) 목록 + 공지 상단 고정
--------------------------------*/
export const getPosts = async (req, res) => {
    const sql = `
        SELECT id, region, category, title, writer, views, likes, created_at, is_notice
        FROM local_board_posts
        WHERE is_blocked = FALSE
        ORDER BY is_notice DESC, id DESC
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
};

/* -----------------------------
   3) 인기글 (조회수 + 좋아요)
--------------------------------*/
export const getPopularPosts = async (req, res) => {
    const sql = `
        SELECT id, title, views, likes, created_at
        FROM local_board_posts
        WHERE created_at >= NOW() - INTERVAL '7 days'
        AND is_blocked = FALSE
        ORDER BY likes DESC, views DESC
        LIMIT 10
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
};

/* -----------------------------
   4) 상세 조회 + 조회수 증가
--------------------------------*/
export const getPostDetail = async (req, res) => {
    const { id } = req.params;

    await pool.query("UPDATE local_board_posts SET views = views + 1 WHERE id=$1", [id]);

    const post = await pool.query("SELECT * FROM local_board_posts WHERE id=$1", [id]);
    const images = await pool.query(
        "SELECT image_url FROM local_board_images WHERE post_id=$1",
        [id]
    );

    res.json({
        ...post.rows[0],
        images: images.rows,
    });
};

/* -----------------------------
   5) 댓글
--------------------------------*/
export const addComment = async (req, res) => {
    const { id } = req.params;
    const { writer, comment } = req.body;

    await pool.query(
        "INSERT INTO local_board_comments (post_id, writer, comment) VALUES ($1,$2,$3)",
        [id, writer, comment]
    );

    res.json({ success: true });
};

export const getComments = async (req, res) => {
    const { id } = req.params;

    const result = await pool.query(
        "SELECT writer, comment, created_at FROM local_board_comments WHERE post_id=$1 ORDER BY id ASC",
        [id]
    );

    res.json(result.rows);
};

/* -----------------------------
   6) 신고
--------------------------------*/
export const reportPost = async (req, res) => {
    const { id } = req.params;

    await pool.query("UPDATE local_board_posts SET reports = reports + 1 WHERE id=$1", [
        id,
    ]);

    res.json({ success: true });
};

/* -----------------------------
   7) 관리자 - 공지 토글
--------------------------------*/
export const toggleNotice = async (req, res) => {
    const { id } = req.params;

    await pool.query("UPDATE local_board_posts SET is_notice = NOT is_notice WHERE id=$1", [
        id,
    ]);

    res.json({ success: true });
};

/* -----------------------------
   8) 관리자 - 게시글 정지
--------------------------------*/
export const blockPost = async (req, res) => {
    const { id } = req.params;

    await pool.query("UPDATE local_board_posts SET is_blocked = TRUE WHERE id=$1", [id]);

    res.json({ success: true });
};
