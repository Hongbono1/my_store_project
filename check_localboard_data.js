import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

async function checkData() {
    try {
        // 게시글 조회
        const posts = await pool.query(`
            SELECT * FROM local_board_posts 
            ORDER BY id DESC
        `);

        console.log("\n📋 게시글 목록:");
        console.log(posts.rows);
        console.log(`\n총 ${posts.rows.length}개의 게시글`);

        // 댓글 조회
        const comments = await pool.query(`
            SELECT * FROM local_board_comments
            ORDER BY id DESC
        `);

        console.log("\n💬 댓글 목록:");
        console.log(comments.rows);
        console.log(`\n총 ${comments.rows.length}개의 댓글`);

        // 이미지 조회
        const images = await pool.query(`
            SELECT * FROM local_board_images
        `);

        console.log("\n🖼️ 이미지 목록:");
        console.log(images.rows);

        process.exit(0);
    } catch (error) {
        console.error("❌ 오류:", error.message);
        process.exit(1);
    }
}

checkData();
