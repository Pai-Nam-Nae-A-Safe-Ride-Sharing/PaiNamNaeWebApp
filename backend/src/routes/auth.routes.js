const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { loginSchema, changePasswordSchema } = require('../validations/auth.validation');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post(
    '/login',
    validate({ body: loginSchema }),
    authController.login
);
router.put(
    '/change-password',
    protect,
    validate({ body: changePasswordSchema }),
    authController.changePassword
);

module.exports = router;