// init_open_stores_table.js - 오픈 예정 매장 테이블 생성
import pool from "./db.js";

async function initOpenStoresTable() {
    try {
        console.log("🔍 open_stores 테이블 확인 중...");
        
        // 테이블 존재 여부 확인
        const checkTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'open_stores'
            );
        `);
        
        if (checkTable.rows[0].exists) {
            console.log("✅ open_stores 테이블이 이미 존재합니다.");
            
            // 테이블 구조 확인
            const columns = await pool.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'open_stores' 
                ORDER BY ordinal_position;
            `);
            
            console.log("📋 현재 테이블 구조:");
            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
            
        } else {
            console.log("📝 open_stores 테이블 생성 중...");
            
            await pool.query(`
                CREATE TABLE open_stores (
                    id SERIAL PRIMARY KEY,
                    store_name VARCHAR(255) NOT NULL,
                    open_date DATE NOT NULL,
                    category VARCHAR(100),
                    phone VARCHAR(50) NOT NULL,
                    description TEXT,
                    address TEXT,
                    lat DECIMAL(10, 7),
                    lng DECIMAL(10, 7),
                    image_path VARCHAR(500),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            
            console.log("✅ open_stores 테이블이 생성되었습니다!");
        }
        
        // 테스트 데이터 확인
        const count = await pool.query(`SELECT COUNT(*) FROM open_stores;`);
        console.log(`📊 현재 등록된 매장 수: ${count.rows[0].count}개`);
        
    } catch (error) {
        console.error("❌ 테이블 초기화 오류:", error);
    } finally {
        await pool.end();
    }
}

// 스크립트 실행
initOpenStoresTable();