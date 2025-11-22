import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

async function removeNotice() {
    try {
        await pool.query(`
            UPDATE local_board_posts 
            SET is_notice = false 
            WHERE id = 1
        `);

        console.log("✅ 게시글 1번 공지 해제 완료!");

        const result = await pool.query(`
            SELECT id, title, is_notice, is_blocked 
            FROM local_board_posts 
            ORDER BY id
        `);

        console.log("\n현재 게시글 상태:");
        result.rows.forEach(row => {
            console.log(`ID ${row.id}: ${row.title} - 공지:${row.is_notice}, 차단:${row.is_blocked}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ 오류:", error);
        process.exit(1);
    }
}

removeNotice();
