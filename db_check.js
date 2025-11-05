// db_check.js - 실제 네온 DB 테이블 상태 확인
import pool from "./db.js";

async function checkDBTable() {
    try {
        console.log("🔍 네온 DB의 open_stores 테이블 확인 중...");
        
        // 테이블 존재 여부 확인
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'open_stores'
            );
        `);
        
        console.log("📋 테이블 존재 여부:", tableExists.rows[0].exists);
        
        if (tableExists.rows[0].exists) {
            // 현재 테이블 구조 확인
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
            
            // lat, lng 컬럼이 있는지 확인
            const hasLatLng = columns.rows.some(col => col.column_name === 'lat' || col.column_name === 'lng');
            
            if (hasLatLng) {
                console.log("❗ 위도/경도 컬럼이 아직 존재합니다. 제거가 필요합니다.");
                
                // 위도/경도 컬럼 제거
                console.log("🔄 lat, lng 컬럼 제거 중...");
                await pool.query(`ALTER TABLE open_stores DROP COLUMN IF EXISTS lat, DROP COLUMN IF EXISTS lng;`);
                console.log("✅ 위도/경도 컬럼 제거 완료!");
                
                // 수정 후 테이블 구조 재확인
                const updatedColumns = await pool.query(`
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = 'open_stores' 
                    ORDER BY ordinal_position;
                `);
                
                console.log("📋 수정된 테이블 구조:");
                updatedColumns.rows.forEach(col => {
                    console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
                });
                
            } else {
                console.log("✅ 위도/경도 컬럼이 이미 제거되어 있습니다.");
            }
            
        } else {
            console.log("📝 open_stores 테이블이 없습니다. 새로 생성합니다...");
            
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
            
            console.log("✅ 새로운 open_stores 테이블 생성 완료!");
        }
        
        // 현재 데이터 개수 확인
        const count = await pool.query(`SELECT COUNT(*) FROM open_stores;`);
        console.log(`📊 현재 등록된 매장 수: ${count.rows[0].count}개`);
        
    } catch (error) {
        console.error("❌ DB 확인 오류:", error.message);
    }
}

checkDBTable();