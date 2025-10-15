const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/hotblogController');

router.get('/random-hotblog', ctrl.getRandomHotBlog);
router.get('/list', ctrl.listHotBlogs);
router.get('/', ctrl.listHotBlogs);
router.get('/:id', ctrl.getHotBlog);

module.exports = router;