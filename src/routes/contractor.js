const express = require('express');
const router = express.Router();
const Joi = require('joi');
const contractorService = require('../services/contractorService');
const ApiResponse = require('../utils/ApiResponse');
const { validateBody } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const optionalText = Joi.string().optional().allow(null, '');
const optionalDate = Joi.date().optional().allow(null, '');

const contractorFields = {
  sube_title: optionalText,
  sube_first_name: optionalText,
  sube_father_husband_name: optionalText,
  sube_last_name: optionalText,
  sube_whatsapp_number: optionalText,
  sube_username: optionalText,
  sube_birth_place: optionalText,
  sube_birth_date: optionalDate,
  sube_taluka: optionalText,
  sube_aadhar_number: optionalText,
  sube_pan_number: optionalText,
  sube_gst_number: optionalText,
  sube_current_address: optionalText,
  sube_technical_qualification: optionalText,
  sube_trade: optionalText,
  sube_institution_name: optionalText,
  sube_university_name: optionalText,
  sube_passing_year: optionalText,
  sube_business_location: optionalText,
  sube_bank_name: optionalText,
  sube_bank_address: optionalText,
  majur_society_name: optionalText,
  majur_society_address: optionalText,
  majur_registration_district: optionalText,
  majur_sub_registrar: optionalText,
  majur_registration_number: optionalText,
  majur_registration_date: optionalDate,
  majur_taluka: optionalText,
  majur_financial_stability: optionalText,
  majur_share_capital: optionalText,
  majur_government_share: optionalText,
  majur_registration_class: optionalText,
  majur_inspection_class: optionalText,
  majur_other_department_classification: optionalText,
  majur_member_in_other_society: optionalText,
  majur_chairman_name: optionalText,
  majur_chairman_whatsapp: optionalText,
  majur_chairman_aadhar: optionalText,
  majur_society_pan: optionalText,
  majur_society_gst: optionalText,
  majur_chairman_address: optionalText
};

const createContractorSchema = Joi.object({
  contractor_type: Joi.string().valid('majur', 'sube').required().label('Contractor type'),
  email: Joi.string().email().optional().allow(null, '').label('Email'),
  ...contractorFields
});

const updateContractorSchema = Joi.object({
  contractor_type: Joi.string().valid('majur', 'sube').optional().label('Contractor type'),
  email: Joi.string().email().optional().allow(null, '').label('Email'),
  status: Joi.string().valid('active', 'inactive').optional().label('Status'),
  ...contractorFields
});

// Get all contractors
router.get('/',
  authenticateToken,
  requirePermission('contractor.view'),
  asyncHandler(async (req, res) => {
    const contractors = await contractorService.getAll(req.query);
    return ApiResponse.success(res, contractors, 'Contractor list retrieved successfully');
  })
);

// Get contractor by ID
router.get('/:id',
  authenticateToken,
  requirePermission('contractor.view'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contractor = await contractorService.getById(parseInt(id));
    return ApiResponse.success(res, contractor, 'Contractor retrieved successfully');
  })
);

// Create new contractor
router.post('/',
  authenticateToken,
  requirePermission('contractor.create'),
  validateBody(createContractorSchema),
  asyncHandler(async (req, res) => {
    const contractorData = req.body;
    const contractor = await contractorService.create(contractorData, req.user.user_id);
    return ApiResponse.created(res, contractor, 'Contractor created successfully');
  })
);

// Update contractor
router.put('/:id',
  authenticateToken,
  requirePermission('contractor.edit'),
  validateBody(updateContractorSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contractorData = req.body;
    const contractor = await contractorService.update(parseInt(id), contractorData, req.user.user_id);
    return ApiResponse.success(res, contractor, 'Contractor updated successfully');
  })
);

// Delete contractor (soft delete)
router.delete('/:id',
  authenticateToken,
  requirePermission('contractor.delete'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contractor = await contractorService.softDelete(parseInt(id), req.user.user_id);
    return ApiResponse.success(res, contractor, 'Contractor deleted successfully');
  })
);

// Get contractor stats
router.get('/stats/summary',
  authenticateToken,
  requirePermission('contractor.view'),
  asyncHandler(async (req, res) => {
    const stats = await contractorService.getStats();
    return ApiResponse.success(res, stats, 'Contractor stats retrieved successfully');
  })
);

// Send credentials email to contractor
router.post('/:id/send-credentials',
  authenticateToken,
  requirePermission('contractor.send_email'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await contractorService.sendCredentialsEmail(parseInt(id), req.user.user_id);
    return ApiResponse.success(res, result, 'Credentials sent successfully');
  })
);

module.exports = router;
