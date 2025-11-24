import pool from "./db.js";

async function checkInquiryImages() {
    try {
        console.log("🔍 문의 이미지 데이터 확인 중...\n");
        
        const result = await pool.query(`
            SELECT 
                id,
                title,
                image1,
                image2,
                image3,
                created_at
            FROM inquiry
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log(`📊 최근 문의 ${result.rows.length}건:\n`);
        
        result.rows.forEach(row => {
            console.log(`ID: ${row.id} | 제목: ${row.title}`);
            console.log(`  📁 이미지1: ${row.image1 || '없음'}`);
            console.log(`  📁 이미지2: ${row.image2 || '없음'}`);
            console.log(`  📁 이미지3: ${row.image3 || '없음'}`);
            console.log('');
        });

        // 이미지가 있는 문의 수
        const withImages = result.rows.filter(r => 
            r.image1 || r.image2 || r.image3
        ).length;
        
        console.log(`✅ 이미지 포함 문의: ${withImages}/${result.rows.length}건`);
        
    } catch (error) {
        console.error("❌ 오류:", error.message);
    } finally {
        process.exit(0);
    }
}

checkInquiryImages();