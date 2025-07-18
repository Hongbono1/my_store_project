// routes/storepride.js
const express = require('express');
const router = express.Router();
const { insertStorePride, getStorePrideById } = require('../controllers/storePrideController');

// 등록(저장) - POST
router.post('/register', insertStorePride);

// 상세조회 - GET
router.get('/:id', getStorePrideById);

module.exports = router;
