const asyncHandler = require('express-async-handler');
const postService = require("../services/post.service");
const ApiError = require('../utils/ApiError');

const getAllPosts = asyncHandler(async (req, res) => {
    const posts = await postService.getAllPosts();
    res.status(200).json({ success: true, message: "Posts retrieved", data: posts });
});

const getPostById = asyncHandler(async (req, res) => {
    const post = await postService.getPostById(req.params.id);
    if (!post) {
        throw new ApiError(404, "Post not found");
    }
    res.status(200).json({ success: true, message: "Post retrieved", data: post });
});

const createPost = asyncHandler(async (req, res) => {
    const authorId = req.user.sub;
    const newPost = await postService.createPost(authorId, req.body);
    res.status(201).json({ success: true, message: "Post created", data: newPost });
});

const updatePost = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const { sub: userId, role: userRole } = req.user;

    let updatedPost;
    if (userRole === 'ADMIN') {
        updatedPost = await postService.adminUpdatePost(postId, req.body);
    } else {
        updatedPost = await postService.updatePost(postId, userId, req.body);
    }
    res.status(200).json({ success: true, message: "Post updated", data: updatedPost });
});

const deletePost = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const { sub: userId, role: userRole } = req.user;

    let deletedPost;
    if (userRole === 'ADMIN') {
        deletedPost = await postService.adminDeletePost(postId);
    } else {
        deletedPost = await postService.deletePost(postId, userId);
    }
    res.status(200).json({
        success: true,
        message: "Post deleted successfully.",
        data: { deletedPostId: deletedPost.id }
    });
});

module.exports = {
    getAllPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
};