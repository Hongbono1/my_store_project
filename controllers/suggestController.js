import pool from "../db.js";

export async function getSuggestionsByMood(req, res) {
    const { mood } = req.query;
    try {
        const result = await pool.query(
            `SELECT m.menu_name, m.menu_image, s.store_name, s.id AS store_id
       FROM store_menu m
       JOIN store_info s ON m.store_id = s.id
       WHERE m.mood = $1
       ORDER BY RANDOM() LIMIT 4;`,
            [mood]
        );
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "DB error" });
    }
}
