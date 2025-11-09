// add_detail_address_column.js - detail_address 컬럼 추가
import pool from "./db.js";

async function addDetailAddressColumn() {
    try {
        console.log("🔍 detail_address 컬럼 존재 여부 확인 중...");
        
        // 컬럼 존재 여부 확인
        const checkColumn = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'open_stores' AND column_name = 'detail_address'
        `);
        
        if (checkColumn.rows.length > 0) {
            console.log("✅ detail_address 컬럼이 이미 존재합니다.");
        } else {
            console.log("📝 detail_address 컬럼 추가 중...");
            
            await pool.query(`
                ALTER TABLE open_stores 
                ADD COLUMN detail_address TEXT
            `);
            
            console.log("✅ detail_address 컬럼이 추가되었습니다!");
        }
        
        // 업데이트된 테이블 구조 확인
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
        
    } catch (error) {
        console.error("❌ 컬럼 추가 오류:", error);
    } finally {
        await pool.end();
    }
}

// 스크립트 실행
addDetailAddressColumn();