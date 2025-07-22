const asyncHandler = require('express-async-handler');
const userService = require("../services/user.service");
const ApiError = require('../utils/ApiError');


const getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers();
    res.status(200).json({ success: true, message: "Users retrieved", data: users });
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    res.status(200).json({ success: true, message: "User retrieved", data: user });
});

const createUser = asyncHandler(async (req, res) => {
    const newUser = await userService.createUser(req.body);
    res.status(201).json({ success: true, message: "User created", data: newUser });
});

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    const updatedUser = await userService.updateUserProfile(req.user.sub, req.body);
    res.status(200).json({ success: true, message: "Profile updated", data: updatedUser });
});

const adminUpdateUser = asyncHandler(async (req, res) => {
    const updatedUser = await userService.updateUserProfile(req.params.id, req.body);
    res.status(200).json({ success: true, message: "User updated by admin", data: updatedUser });
});

const adminDeleteUser = asyncHandler(async (req, res) => {
    const deletedUser = await userService.deleteUser(req.params.id);
    res.status(200).json({
        success: true,
        message: "User deleted successfully.",
        data: { deletedUserId: deletedUser.id }
    });
});


const setUserStatus = asyncHandler(async (req, res) => {
    const updatedUser = await userService.setUserStatus(req.params.id, req.body.isActive);
    res.status(200).json({ success: true, message: "User status updated", data: updatedUser });
});

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateCurrentUserProfile,
    adminUpdateUser,
    adminDeleteUser,
    setUserStatus,
};