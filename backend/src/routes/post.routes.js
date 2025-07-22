const express = require('express');
const postController = require("../controllers/post.controller");
const validate = require('../middlewares/validate');
const { idParamSchema, createPostSchema, updatePostSchema } = require('../validations/post.validation');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.get(
    '/',
    postController.getAllPosts

);
router.get(
    '/:id',
    validate({ params: idParamSchema }),
    postController.getPostById
);
router.post(
    '/',
    protect, validate({ body: createPostSchema }),
    postController.createPost
);
router.put(
    '/:id',
    protect, validate({ params: idParamSchema, body: updatePostSchema }),
    postController.updatePost
);
router.delete(
    '/:id',
    protect, validate({ params: idParamSchema }),
    postController.deletePost
);

module.exports = router;
