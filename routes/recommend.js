router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM recommendation_info ORDER BY id DESC LIMIT 10");
  res.json(rows);
});
router.get("/api", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM recommendation_info ORDER BY id DESC LIMIT 10");
  res.json(rows);
});
export default router; 