import pool from "./db.js";

async function initInquiryTable() {
    try {
        console.log("🔍 inquiry 테이블 초기화 시작 (이미지 업로드 지원)...");
        
        // inquiry 테이블 생성/수정
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inquiry (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                user_name VARCHAR(100) NOT NULL,
                user_phone VARCHAR(20),
                file_paths JSON,
                answer TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log("✅ inquiry 테이블이 생성/수정되었습니다.");
        
        // file_paths 컬럼 확인 및 추가
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'inquiry' 
            AND column_name = 'file_paths'
        `);

        if (checkColumn.rowCount === 0) {
            console.log("📝 inquiry 테이블에 file_paths 컬럼 추가 중...");
            await pool.query(`ALTER TABLE inquiry ADD COLUMN file_paths JSON`);
            console.log("✅ file_paths 컬럼이 추가되었습니다.");
        }
        
        // 샘플 데이터 확인 및 추가
        const checkData = await pool.query("SELECT COUNT(*) FROM inquiry");
        const currentCount = parseInt(checkData.rows[0].count);
        
        if (currentCount === 0) {
            console.log("📝 샘플 데이터 추가 중...");
            await pool.query(`
                INSERT INTO inquiry (title, content, user_name, user_phone, answer, file_paths) VALUES
                ('매장 등록 문의', '새로운 매장을 등록하고 싶습니다. 절차를 알려주세요.', '김상점', '010-1234-5678', '안녕하세요. 매장 등록은 메인 페이지의 "매장 등록" 버튼을 통해 가능합니다.', '[]'),
                ('결제 오류 문의', '결제 진행 중 오류가 발생했습니다.', '이고객', '010-9876-5432', null, '["/uploads/inquiry/sample1.jpg"]'),
                ('서비스 개선 제안', '지역별 검색 기능을 추가해주세요.', '박제안', null, '좋은 제안 감사합니다. 검토 후 반영하겠습니다.', '[]'),
                ('매장 정보 수정', '등록된 매장 정보를 수정하고 싶어요.', '이사장', '010-5555-6666', null, '["/uploads/inquiry/sample2.jpg", "/uploads/inquiry/sample3.jpg"]')
            `);
            console.log("✅ 샘플 데이터 4건이 추가되었습니다.");
        } else {
            console.log(`✅ 기존 데이터 ${currentCount}건이 있습니다.`);
        }

        console.log("🎉 문의 시스템 (이미지 업로드 지원) 데이터베이스 준비 완료!");

    } catch (error) {
        console.error("❌ 초기화 오류:", error.message);
    } finally {
        process.exit(0);
    }
}

initInquiryTable();