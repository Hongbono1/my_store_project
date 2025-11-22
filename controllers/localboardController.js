import pool from "../db.js";

/* -----------------------------
   0) 닉네임 중복 체크
--------------------------------*/
export const checkNickname = async (req, res) => {
    try {
        const { nickname } = req.query;

        if (!nickname) {
            return res.json({ available: false, error: "닉네임을 입력해주세요" });
        }

        // 해당 닉네임으로 작성된 글이 있는지 확인
        const result = await pool.query(
            "SELECT COUNT(*) as count FROM local_board_posts WHERE writer = $1",
            [nickname]
        );

        const count = parseInt(result.rows[0].count);
        const available = count === 0;

        res.json({ available });
    } catch (error) {
        console.error("닉네임 중복 체크 오류:", error);
        res.status(500).json({ available: false, error: "서버 오류" });
    }
};

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
   6) 신고 (닉네임 기반 중복 방지)
--------------------------------*/
export const reportPost = async (req, res) => {
    const { id } = req.params;
    const { nickname } = req.body;

    if (!nickname) {
        return res.json({ success: false, error: "닉네임이 필요합니다" });
    }

    try {
        // 이미 신고했는지 확인
        const checkResult = await pool.query(
            "SELECT * FROM post_reports WHERE post_id = $1 AND nickname = $2",
            [id, nickname]
        );

        if (checkResult.rows.length > 0) {
            return res.json({ success: false, error: "이미 신고한 게시글입니다", alreadyReported: true });
        }

        // 신고 기록 저장
        await pool.query(
            "INSERT INTO post_reports (post_id, nickname) VALUES ($1, $2)",
            [id, nickname]
        );

        // 신고 수 증가
        await pool.query("UPDATE local_board_posts SET reports = reports + 1 WHERE id=$1", [
            id,
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error("신고 오류:", error);
        res.status(500).json({ success: false, error: "신고 처리 중 오류 발생" });
    }
};

/* -----------------------------
   7) 추천 (닉네임 기반 중복 방지)
--------------------------------*/
export const likePost = async (req, res) => {
    const { id } = req.params;
    const { nickname } = req.body;

    if (!nickname) {
        return res.json({ success: false, error: "닉네임이 필요합니다" });
    }

    try {
        // 이미 추천했는지 확인
        const checkResult = await pool.query(
            "SELECT * FROM post_likes WHERE post_id = $1 AND nickname = $2",
            [id, nickname]
        );

        if (checkResult.rows.length > 0) {
            return res.json({ success: false, error: "이미 추천한 게시글입니다", alreadyLiked: true });
        }

        // 추천 기록 저장
        await pool.query(
            "INSERT INTO post_likes (post_id, nickname) VALUES ($1, $2)",
            [id, nickname]
        );

        // 추천 수 증가
        const result = await pool.query(
            "UPDATE local_board_posts SET likes = likes + 1 WHERE id=$1 RETURNING likes",
            [id]
        );

        res.json({ success: true, likes: result.rows[0].likes });
    } catch (error) {
        console.error("추천 오류:", error);
        res.status(500).json({ success: false, error: "추천 처리 중 오류 발생" });
    }
};
