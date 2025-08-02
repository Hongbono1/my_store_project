import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export async function registerDelivery(req, res) {
    try {
        const {
            name, birth, phone, address, detail_address, vehicle,
            license_type, license_number, region_province, region_city,
            available_time, latitude, longitude, agree
        } = req.body;

        const profile_image = req.files.profile_image?.[0]?.filename || null;
        const license_image = req.files.license_image?.[0]?.filename || null;
        const insurance_image = req.files.insurance_image?.[0]?.filename || null;

        const result = await pool.query(
            `INSERT INTO deliveryregister (
        profile_image, name, birth, phone, address, detail_address, vehicle,
        license_type, license_number, license_image, insurance_image,
        region_province, region_city, available_time, latitude, longitude, agree
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
      ) RETURNING id`,
            [
                profile_image, name, birth, phone, address, detail_address, vehicle,
                license_type, license_number, license_image, insurance_image,
                region_province, region_city, available_time,
                latitude || null, longitude || null,
                agree === "on" ? true : false
            ]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "등록 실패", error: err.message });
    }
}
