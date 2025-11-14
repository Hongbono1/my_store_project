// test_storepride_data.js
import pool from "./db.js";

async function checkStorePrideData() {
    try {
        console.log("📊 Store Pride 데이터 확인 중...");

        // 1. 메인 테이블 데이터 조회
        const prideData = await pool.query(`
            SELECT id, store_name, category, phone, address, main_img, free_pr, qa_mode, created_at
            FROM store_pride 
            ORDER BY created_at DESC 
            LIMIT 5;
        `);
        
        console.log("\n📋 최근 등록된 Store Pride 데이터:");
        prideData.rows.forEach((row, idx) => {
            console.log(`\n${idx + 1}. ID: ${row.id}`);
            console.log(`   가게명: ${row.store_name}`);
            console.log(`   업종: ${row.category}`);
            console.log(`   전화: ${row.phone}`);
            console.log(`   주소: ${row.address}`);
            console.log(`   대표이미지: ${row.main_img || '없음'}`);
            console.log(`   질문모드: ${row.qa_mode}`);
            console.log(`   등록일: ${row.created_at}`);
            console.log(`   자유PR: ${row.free_pr?.slice(0, 50)}${row.free_pr?.length > 50 ? '...' : ''}`);
        });

        if (prideData.rows.length > 0) {
            // 2. 가장 최근 등록된 데이터의 Q&A 조회
            const latestId = prideData.rows[0].id;
            const qasData = await pool.query(`
                SELECT qa_type, seq, question, answer, image_path
                FROM store_pride_qas 
                WHERE pride_id = $1
                ORDER BY qa_type, seq;
            `, [latestId]);

            console.log(`\n🤔 ID ${latestId}의 Q&A 데이터 (${qasData.rows.length}개):`);
            qasData.rows.forEach((qa, idx) => {
                console.log(`\n   ${idx + 1}. [${qa.qa_type}] 순서: ${qa.seq}`);
                console.log(`      질문: ${qa.question.slice(0, 40)}${qa.question.length > 40 ? '...' : ''}`);
                console.log(`      답변: ${qa.answer.slice(0, 50)}${qa.answer.length > 50 ? '...' : ''}`);
                console.log(`      이미지: ${qa.image_path || '없음'}`);
            });
        }

        // 3. 전체 통계
        const totalCount = await pool.query("SELECT COUNT(*) as count FROM store_pride");
        const totalQAs = await pool.query("SELECT COUNT(*) as count FROM store_pride_qas");
        
        console.log(`\n📊 전체 통계:`);
        console.log(`   - 등록된 가게 수: ${totalCount.rows[0].count}개`);
        console.log(`   - 총 Q&A 수: ${totalQAs.rows[0].count}개`);

        console.log("\n✅ 데이터 확인 완료!");

    } catch (error) {
        console.error("❌ 데이터 확인 중 오류:", error);
    } finally {
        process.exit(0);
    }
}

checkStorePrideData();