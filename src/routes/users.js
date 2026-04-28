const express = require('express');
const router = express.Router();
const Joi = require('joi');
const userService = require('../services/userService');
const ApiResponse = require('../utils/ApiResponse');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateBody, validateParams, commonSchemas } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/auditLog');
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  full_name: Joi.string().min(2).max(100).required(),
  role_id: Joi.number().integer().positive().required()
});

const updateUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(100),
  email: Joi.string().email(),
  role_id: Joi.number().integer().positive(),
  is_active: Joi.boolean(),
  email_verified: Joi.boolean()
});

const userIdSchema = Joi.object({
  id: commonSchemas.id
});

router.get('/',
  authenticateToken,
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const result = await userService.getAll(req.query);
    return ApiResponse.success(res, result, 'Users retrieved successfully');
  })
);

router.get('/:id',
  authenticateToken,
  requirePermission('users.view'),
  validateParams(userIdSchema),
  asyncHandler(async (req, res) => {
    const user = await userService.getById(req.params.id);
    return ApiResponse.success(res, user);
  })
);

router.post('/',
  authenticateToken,
  requirePermission('users.create'),
  validateBody(createUserSchema),
  auditLog('CREATE_USER'),
  asyncHandler(async (req, res) => {
    const user = await userService.create(req.body, req.user.user_id);
    return ApiResponse.created(res, user, 'User created successfully');
  })
);

router.put('/:id',
  authenticateToken,
  requirePermission('users.edit'),
  validateParams(userIdSchema),
  validateBody(updateUserSchema),
  auditLog('UPDATE_USER'),
  asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body, req.user.user_id);
    return ApiResponse.success(res, user, 'User updated successfully');
  })
);

router.delete('/:id',
  authenticateToken,
  requirePermission('users.delete'),
  validateParams(userIdSchema),
  auditLog('DELETE_USER'),
  asyncHandler(async (req, res) => {
    await userService.remove(req.params.id, req.user.user_id);
    return ApiResponse.deleted(res, 'User deleted successfully');
  })
);

module.exports = router;
