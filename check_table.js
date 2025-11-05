// check_table.js - 테이블 상태 확인
import pool from "./db.js";

async function checkTable() {
    try {
        console.log("🔍 테이블 확인 중...");
        
        // 연결 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 테이블 존재 여부 확인
        const checkTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'open_stores'
            );
        `);
        
        console.log("테이블 존재:", checkTable.rows[0].exists);
        
        if (!checkTable.rows[0].exists) {
            console.log("📝 테이블 생성 중...");
            
            await pool.query(`
                CREATE TABLE open_stores (
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
            
            console.log("✅ 테이블 생성 완료!");
        }
        
        // 테이블 구조 확인
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'open_stores' 
            ORDER BY ordinal_position;
        `);
        
        console.log("📋 테이블 구조:");
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
    } catch (error) {
        console.error("❌ 오류:", error.message);
    } finally {
        process.exit(0);
    }
}

checkTable();