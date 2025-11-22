import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

async function unblockPost() {
    try {
        await pool.query(`
            UPDATE local_board_posts 
            SET is_blocked = false 
            WHERE id = 1
        `);

        console.log("✅ 게시글 1번 차단 해제 완료!");

        const result = await pool.query(`
            SELECT id, title, writer, is_blocked 
            FROM local_board_posts 
            WHERE id = 1
        `);

        console.log(result.rows[0]);

        process.exit(0);
    } catch (error) {
        console.error("❌ 오류:", error);
        process.exit(1);
    }
}

unblockPost();
