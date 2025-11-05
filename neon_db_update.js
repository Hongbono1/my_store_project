// neon_db_update.js - 네온 DB를 수정된 코드에 맞게 업데이트
import pool from "./db.js";

async function updateNeonDB() {
    try {
        console.log("🔄 네온 DB 업데이트 시작...");
        
        // 1. 현재 테이블 상태 확인
        console.log("\n📋 현재 테이블 구조 확인:");
        try {
            const currentColumns = await pool.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'open_stores' 
                ORDER BY ordinal_position;
            `);
            
            if (currentColumns.rows.length > 0) {
                console.log("현재 컬럼들:");
                currentColumns.rows.forEach(col => {
                    console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
                });
            } else {
                console.log("❌ open_stores 테이블이 존재하지 않습니다.");
            }
        } catch (err) {
            console.log("❌ 테이블이 존재하지 않거나 확인 실패:", err.message);
        }
        
        // 2. 불필요한 컬럼 제거
        console.log("\n🗑️  불필요한 컬럼 제거 중...");
        
        try {
            await pool.query(`ALTER TABLE open_stores DROP COLUMN IF EXISTS lat;`);
            console.log("✅ lat 컬럼 제거 완료");
        } catch (err) {
            console.log("⚠️  lat 컬럼 제거 실패 (없거나 이미 제거됨):", err.message);
        }
        
        try {
            await pool.query(`ALTER TABLE open_stores DROP COLUMN IF EXISTS lng;`);
            console.log("✅ lng 컬럼 제거 완료");
        } catch (err) {
            console.log("⚠️  lng 컬럼 제거 실패 (없거나 이미 제거됨):", err.message);
        }
        
        try {
            await pool.query(`ALTER TABLE open_stores DROP COLUMN IF EXISTS detail_address;`);
            console.log("✅ detail_address 컬럼 제거 완료");
        } catch (err) {
            console.log("⚠️  detail_address 컬럼 제거 실패 (없거나 이미 제거됨):", err.message);
        }
        
        // 3. 테이블이 없다면 새로 생성
        console.log("\n📝 테이블 생성 확인...");
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS open_stores (
                    id SERIAL PRIMARY KEY,
                    store_name VARCHAR(255) NOT NULL,
                    open_date DATE NOT NULL,
                    category VARCHAR(100),
                    phone VARCHAR(50) NOT NULL,
                    description TEXT,
                    address TEXT,
                    image_path VARCHAR(500),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("✅ 테이블 생성/확인 완료");
        } catch (err) {
            console.log("❌ 테이블 생성 실패:", err.message);
        }
        
        // 4. 업데이트된 테이블 구조 확인
        console.log("\n📋 업데이트된 테이블 구조:");
        try {
            const updatedColumns = await pool.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'open_stores' 
                ORDER BY ordinal_position;
            `);
            
            console.log("최종 컬럼들:");
            updatedColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        } catch (err) {
            console.log("❌ 테이블 구조 확인 실패:", err.message);
        }
        
        // 5. 현재 데이터 개수 확인
        console.log("\n📊 데이터 현황:");
        try {
            const count = await pool.query(`SELECT COUNT(*) as total_stores FROM open_stores;`);
            console.log(`현재 등록된 매장 수: ${count.rows[0].total_stores}개`);
        } catch (err) {
            console.log("❌ 데이터 개수 확인 실패:", err.message);
        }
        
        console.log("\n✅ 네온 DB 업데이트 완료!");
        
    } catch (error) {
        console.error("❌ DB 업데이트 오류:", error.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

// 스크립트 실행
updateNeonDB();