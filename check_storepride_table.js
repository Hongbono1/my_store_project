// check_storepride_table.js
import pool from "./db.js";

async function checkStorePrideTables() {
    try {
        console.log("🔍 Store Pride 테이블 구조 확인 중...");

        // 1. store_pride 테이블 확인 및 생성
        const mainTableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'store_pride'
            );
        `);

        if (!mainTableExists.rows[0].exists) {
            console.log("📝 store_pride 테이블 생성 중...");
            await pool.query(`
                CREATE TABLE store_pride (
                    id SERIAL PRIMARY KEY,
                    store_name VARCHAR(255) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    phone VARCHAR(50),
                    address TEXT NOT NULL,
                    main_img TEXT,
                    free_pr TEXT,
                    qa_mode VARCHAR(20) NOT NULL CHECK (qa_mode IN ('fixed', 'custom')),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("✅ store_pride 테이블이 생성되었습니다!");
        } else {
            console.log("✅ store_pride 테이블이 이미 존재합니다.");
        }

        // 2. store_pride_qas 테이블 확인 및 생성
        const qasTableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'store_pride_qas'
            );
        `);

        if (!qasTableExists.rows[0].exists) {
            console.log("📝 store_pride_qas 테이블 생성 중...");
            await pool.query(`
                CREATE TABLE store_pride_qas (
                    id SERIAL PRIMARY KEY,
                    pride_id INTEGER REFERENCES store_pride(id) ON DELETE CASCADE,
                    qa_type VARCHAR(20) NOT NULL CHECK (qa_type IN ('fixed', 'custom')),
                    seq INTEGER NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    image_path TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("✅ store_pride_qas 테이블이 생성되었습니다!");
        } else {
            console.log("✅ store_pride_qas 테이블이 이미 존재합니다.");
        }

        // 3. 테이블 구조 확인
        console.log("\n📋 store_pride 테이블 구조:");
        const prideColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'store_pride' 
            ORDER BY ordinal_position;
        `);
        prideColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(NULL 가능)' : '(NOT NULL)'}`);
        });

        console.log("\n📋 store_pride_qas 테이블 구조:");
        const qasColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'store_pride_qas' 
            ORDER BY ordinal_position;
        `);
        qasColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(NULL 가능)' : '(NOT NULL)'}`);
        });

        // 4. 데이터 개수 확인
        const prideCount = await pool.query("SELECT COUNT(*) as count FROM store_pride");
        const qasCount = await pool.query("SELECT COUNT(*) as count FROM store_pride_qas");
        
        console.log(`\n📊 현재 데이터:`);
        console.log(`  - store_pride: ${prideCount.rows[0].count}개`);
        console.log(`  - store_pride_qas: ${qasCount.rows[0].count}개`);

        console.log("\n✅ Store Pride 테이블 체크 완료!");

    } catch (error) {
        console.error("❌ 테이블 체크 중 오류:", error);
    } finally {
        process.exit(0);
    }
}

checkStorePrideTables();