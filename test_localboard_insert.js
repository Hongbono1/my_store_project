import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

async function insertTestData() {
    try {
        // 테스트 게시글 삽입
        const result = await pool.query(`
            INSERT INTO local_board_posts 
            (region, title, content, writer, views, likes, reports, is_notice, is_blocked)
            VALUES 
            ('의정부', '의정부 맛집 추천합니다', '신곡동에 있는 고기집 진짜 맛있어요!', '의정부맘', 15, 3, 0, false, false),
            ('호원동', '호원동 카페 아시는 분?', '분위기 좋은 카페 찾고 있어요', '호원주민', 8, 1, 0, false, false),
            ('민락동', '[공지] 민락동 축제 안내', '이번 주말 민락동 축제가 열립니다', '관리자', 25, 5, 0, true, false)
            RETURNING id
        `);

        console.log("✅ 테스트 게시글 삽입 완료:", result.rows);

        // 첫 번째 게시글에 이미지 추가 (선택사항)
        const postId = result.rows[0].id;
        await pool.query(`
            INSERT INTO local_board_images (post_id, image_url)
            VALUES ($1, '/uploads/test_image.jpg')
        `, [postId]);

        console.log("✅ 테스트 이미지 추가 완료");

        // 댓글 추가
        await pool.query(`
            INSERT INTO local_board_comments (post_id, writer, comment)
            VALUES 
            ($1, '민락맘', '정보 감사합니다!'),
            ($1, '의정부주민', '저도 가봤는데 좋더라구요')
        `, [postId]);

        console.log("✅ 테스트 댓글 추가 완료");

        process.exit(0);
    } catch (error) {
        console.error("❌ 오류:", error);
        process.exit(1);
    }
}

insertTestData();
