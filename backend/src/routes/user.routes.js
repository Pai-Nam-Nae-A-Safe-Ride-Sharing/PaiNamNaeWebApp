const express = require('express');
const userController = require("../controllers/user.controller");
const validate = require('../middlewares/validate');
const { idParamSchema, createUserSchema, updateUserSchema, updateUserStatusSchema } = require('../validations/user.validation');
const { protect, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// --- Admin Routes ---
router.get(
    '/admin/users',
    protect,
    requireAdmin,
    userController.getAllUsers
);
router.put(
    '/admin/users/:id',
    protect,
    requireAdmin,
    validate({ params: idParamSchema, body: updateUserSchema }),
    userController.adminUpdateUser
);
router.delete(
    '/admin/users/:id',
    protect,
    requireAdmin,
    validate({ params: idParamSchema }),
    userController.adminDeleteUser
);
router.patch(
    '/admin/users/:id/status',
    protect,
    requireAdmin,
    validate({ params: idParamSchema, body: updateUserStatusSchema }),
    userController.setUserStatus

);

// --- Public / User-specific Routes ---
router.get(
    '/users/:id',
    validate({ params: idParamSchema }),
    userController.getUserById
);
router.post(
    '/users',
    validate({ body: createUserSchema }),
    userController.createUser
);
router.put(
    '/users/me',
    protect,
    validate({ body: updateUserSchema }),
    userController.updateCurrentUserProfile
);

module.exports = router;