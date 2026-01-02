import pool from "./db.js";

async function checkSubcategories() {
    try {
        const result = await pool.query(`
            SELECT DISTINCT business_category, business_subcategory 
            FROM combined_store_info 
            WHERE business_category LIKE '%미용%' 
               OR business_category LIKE '%이발%' 
               OR business_subcategory LIKE '%미용%' 
               OR business_subcategory LIKE '%이발%'
            ORDER BY business_category, business_subcategory
        `);
        
        console.log("미용/이발 관련 카테고리 데이터:");
        console.log(JSON.stringify(result.rows, null, 2));
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

checkSubcategories();
