const { query } = require("../config/db");
const { ApiError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const bcrypt = require("bcrypt");
const { getBcryptRounds } = require("../config/security");
const {
  getPaginationParams,
  getSortParams,
  buildPaginationResponse,
} = require("../utils/pagination");
const {
  generatePassword,
  sendContractorCredentials,
} = require("./emailService");

const ALLOWED_SORT_FIELDS = [
  "contractor_id",
  "contractor_type",
  "email",
  "status",
  "created_at",
  "updated_at",
];

// Build dynamic field list for contractor type
const buildFieldList = (type, data) => {
  const fields = [];
  const values = [];

  if (type === "sube") {
    // Sube fields
    if (data.sube_title !== undefined) {
      fields.push("sube_title");
      values.push(data.sube_title);
    }
    if (data.sube_first_name !== undefined) {
      fields.push("sube_first_name");
      values.push(data.sube_first_name);
    }
    if (data.sube_father_husband_name !== undefined) {
      fields.push("sube_father_husband_name");
      values.push(data.sube_father_husband_name);
    }
    if (data.sube_last_name !== undefined) {
      fields.push("sube_last_name");
      values.push(data.sube_last_name);
    }
    if (data.sube_whatsapp_number !== undefined) {
      fields.push("sube_whatsapp_number");
      values.push(data.sube_whatsapp_number);
    }
    if (data.sube_username !== undefined) {
      fields.push("sube_username");
      values.push(data.sube_username);
    }
    if (data.sube_birth_place !== undefined) {
      fields.push("sube_birth_place");
      values.push(data.sube_birth_place);
    }
    if (data.sube_birth_date !== undefined) {
      fields.push("sube_birth_date");
      values.push(data.sube_birth_date);
    }
    if (data.sube_taluka !== undefined) {
      fields.push("sube_taluka");
      values.push(data.sube_taluka);
    }
    if (data.sube_aadhar_number !== undefined) {
      fields.push("sube_aadhar_number");
      values.push(data.sube_aadhar_number);
    }
    if (data.sube_pan_number !== undefined) {
      fields.push("sube_pan_number");
      values.push(data.sube_pan_number);
    }
    if (data.sube_gst_number !== undefined) {
      fields.push("sube_gst_number");
      values.push(data.sube_gst_number);
    }
    if (data.sube_current_address !== undefined) {
      fields.push("sube_current_address");
      values.push(data.sube_current_address);
    }
    if (data.sube_technical_qualification !== undefined) {
      fields.push("sube_technical_qualification");
      values.push(data.sube_technical_qualification);
    }
    if (data.sube_trade !== undefined) {
      fields.push("sube_trade");
      values.push(data.sube_trade);
    }
    if (data.sube_institution_name !== undefined) {
      fields.push("sube_institution_name");
      values.push(data.sube_institution_name);
    }
    if (data.sube_university_name !== undefined) {
      fields.push("sube_university_name");
      values.push(data.sube_university_name);
    }
    if (data.sube_passing_year !== undefined) {
      fields.push("sube_passing_year");
      values.push(data.sube_passing_year);
    }
    if (data.sube_business_location !== undefined) {
      fields.push("sube_business_location");
      values.push(data.sube_business_location);
    }
    if (data.sube_bank_name !== undefined) {
      fields.push("sube_bank_name");
      values.push(data.sube_bank_name);
    }
    if (data.sube_bank_address !== undefined) {
      fields.push("sube_bank_address");
      values.push(data.sube_bank_address);
    }
  } else if (type === "majur") {
    // Majur fields
    if (data.majur_society_name !== undefined) {
      fields.push("majur_society_name");
      values.push(data.majur_society_name);
    }
    if (data.majur_society_address !== undefined) {
      fields.push("majur_society_address");
      values.push(data.majur_society_address);
    }
    if (data.majur_registration_district !== undefined) {
      fields.push("majur_registration_district");
      values.push(data.majur_registration_district);
    }
    if (data.majur_sub_registrar !== undefined) {
      fields.push("majur_sub_registrar");
      values.push(data.majur_sub_registrar);
    }
    if (data.majur_registration_number !== undefined) {
      fields.push("majur_registration_number");
      values.push(data.majur_registration_number);
    }
    if (data.majur_registration_date !== undefined) {
      fields.push("majur_registration_date");
      values.push(data.majur_registration_date);
    }
    if (data.majur_taluka !== undefined) {
      fields.push("majur_taluka");
      values.push(data.majur_taluka);
    }
    if (data.majur_financial_stability !== undefined) {
      fields.push("majur_financial_stability");
      values.push(data.majur_financial_stability);
    }
    if (data.majur_share_capital !== undefined) {
      fields.push("majur_share_capital");
      values.push(data.majur_share_capital);
    }
    if (data.majur_government_share !== undefined) {
      fields.push("majur_government_share");
      values.push(data.majur_government_share);
    }
    if (data.majur_registration_class !== undefined) {
      fields.push("majur_registration_class");
      values.push(data.majur_registration_class);
    }
    if (data.majur_inspection_class !== undefined) {
      fields.push("majur_inspection_class");
      values.push(data.majur_inspection_class);
    }
    if (data.majur_other_department_classification !== undefined) {
      fields.push("majur_other_department_classification");
      values.push(data.majur_other_department_classification);
    }
    if (data.majur_member_in_other_society !== undefined) {
      fields.push("majur_member_in_other_society");
      values.push(data.majur_member_in_other_society);
    }
    if (data.majur_chairman_name !== undefined) {
      fields.push("majur_chairman_name");
      values.push(data.majur_chairman_name);
    }
    if (data.majur_chairman_whatsapp !== undefined) {
      fields.push("majur_chairman_whatsapp");
      values.push(data.majur_chairman_whatsapp);
    }
    if (data.majur_chairman_aadhar !== undefined) {
      fields.push("majur_chairman_aadhar");
      values.push(data.majur_chairman_aadhar);
    }
    if (data.majur_society_pan !== undefined) {
      fields.push("majur_society_pan");
      values.push(data.majur_society_pan);
    }
    if (data.majur_society_gst !== undefined) {
      fields.push("majur_society_gst");
      values.push(data.majur_society_gst);
    }
    if (data.majur_chairman_address !== undefined) {
      fields.push("majur_chairman_address");
      values.push(data.majur_chairman_address);
    }
  }

  return { fields, values };
};

const getAll = async (queryParams) => {
  const { page, limit, offset } = getPaginationParams(queryParams);
  const { sort, order } = getSortParams(queryParams, ALLOWED_SORT_FIELDS);

  const conditions = ["c.status != 'deleted'"];
  const values = [];
  let paramIndex = 1;

  if (queryParams.status && queryParams.status !== "all") {
    conditions.push(`c.status = $${paramIndex++}`);
    values.push(queryParams.status);
  }

  if (queryParams.contractor_type) {
    conditions.push(`c.contractor_type = $${paramIndex++}`);
    values.push(queryParams.contractor_type);
  }

  if (queryParams.search) {
    conditions.push(
      `(c.email ILIKE $${paramIndex} OR c.sube_first_name ILIKE $${paramIndex} OR c.sube_last_name ILIKE $${paramIndex} OR c.majur_society_name ILIKE $${paramIndex})`,
    );
    values.push(`%${queryParams.search}%`);
    paramIndex++;
  }

  const whereClause = "WHERE " + conditions.join(" AND ");

  const countResult = await query(
    `SELECT COUNT(*) as total FROM iwms_contractor c ${whereClause}`,
    values,
  );
  const total = parseInt(countResult.rows[0].total);

  const dataResult = await query(
    `SELECT c.*, 
            uc.full_name as created_by_name,
            uu.full_name as updated_by_name
     FROM iwms_contractor c
     LEFT JOIN iwms_users uc ON c.created_by = uc.user_id
     LEFT JOIN iwms_users uu ON c.updated_by = uu.user_id
     ${whereClause}
     ORDER BY c.${sort} ${order}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset],
  );

  return buildPaginationResponse(dataResult.rows, total, page, limit);
};

const getById = async (contractorId) => {
  const result = await query(
    `
    SELECT c.*, 
           uc.full_name as created_by_name,
           uu.full_name as updated_by_name
    FROM iwms_contractor c
    LEFT JOIN iwms_users uc ON c.created_by = uc.user_id
    LEFT JOIN iwms_users uu ON c.updated_by = uu.user_id
    WHERE c.contractor_id = $1 AND c.status != 'deleted'
  `,
    [contractorId],
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound("Contractor not found");
  }

  // Remove password_hash from response
  const contractor = result.rows[0];
  delete contractor.password_hash;

  return contractor;
};

const create = async (contractorData, userId) => {
  const { contractor_type, email } = contractorData;

  if (!contractor_type || !email) {
    throw ApiError.badRequest("Contractor type and email are required");
  }

  const { fields, values } = buildFieldList(contractor_type, contractorData);

  // Add common fields
  fields.push(
    "contractor_type",
    "email",
    "created_by",
    "updated_by",
  );
  values.push(contractor_type, email, userId, userId);

  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

  const result = await query(
    `
    INSERT INTO iwms_contractor (${fields.join(", ")})
    VALUES (${placeholders})
    RETURNING *
  `,
    values,
  );

  logger.info(
    `Contractor created: ${result.rows[0].contractor_id} (${contractor_type}) by user ${userId}`,
  );

  const contractor = result.rows[0];
  delete contractor.password_hash;

  return contractor;
};

const update = async (contractorId, contractorData, userId) => {
  const existing = await query(
    "SELECT contractor_id, contractor_type, email_sent FROM iwms_contractor WHERE contractor_id = $1 AND status != 'deleted'",
    [contractorId],
  );
  if (existing.rows.length === 0) {
    throw ApiError.notFound("Contractor not found");
  }

  const currentType = existing.rows[0].contractor_type;
  const newType = contractorData.contractor_type || currentType;

  const { fields, values } = buildFieldList(newType, contractorData);

  // Add common updatable fields
  if (contractorData.email !== undefined) {
    fields.push("email");
    values.push(contractorData.email);
  }
  if (contractorData.status !== undefined) {
    fields.push("status");
    values.push(contractorData.status);
  }

  fields.push("updated_by");
  values.push(userId);

  if (fields.length === 1) {
    throw ApiError.badRequest("No fields to update");
  }

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(", ");
  values.push(contractorId);

  const result = await query(
    `
    UPDATE iwms_contractor 
    SET ${setClause}
    WHERE contractor_id = $${values.length}
    RETURNING *
  `,
    values,
  );

  logger.info(`Contractor updated: ${contractorId} by user ${userId}`);

  const contractor = result.rows[0];
  delete contractor.password_hash;

  return contractor;
};

const softDelete = async (contractorId, userId) => {
  const existing = await query(
    "SELECT contractor_id, email_sent FROM iwms_contractor WHERE contractor_id = $1 AND status != 'deleted'",
    [contractorId],
  );
  if (existing.rows.length === 0) {
    throw ApiError.notFound("Contractor not found");
  }

  // Prevent deletion if email has been sent (credentials generated)
  if (existing.rows[0].email_sent) {
    throw ApiError.badRequest(
      "Cannot delete contractor with active credentials. Please deactivate instead.",
    );
  }

  const result = await query(
    `
    UPDATE iwms_contractor 
    SET status = 'deleted',
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = $1,
        updated_by = $1
    WHERE contractor_id = $2
    RETURNING *
  `,
    [userId, contractorId],
  );

  logger.info(`Contractor deleted: ${contractorId} by user ${userId}`);
  return result.rows[0];
};

const sendCredentialsEmail = async (contractorId, userId) => {
  const contractor = await query(
    "SELECT * FROM iwms_contractor WHERE contractor_id = $1 AND status != 'deleted'",
    [contractorId],
  );

  if (contractor.rows.length === 0) {
    throw ApiError.notFound("Contractor not found");
  }

  const contractorData = contractor.rows[0];

  if (!contractorData.email) {
    throw ApiError.badRequest("Contractor does not have an email address");
  }

  if (contractorData.email_sent) {
    throw ApiError.badRequest(
      "Credentials have already been sent to this contractor",
    );
  }

  // Generate password
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, getBcryptRounds());

  // Update contractor with password hash
  await query(
    `
    UPDATE iwms_contractor 
    SET password_hash = $1,
        email_sent = true,
        email_sent_at = CURRENT_TIMESTAMP,
        updated_by = $2
    WHERE contractor_id = $3
  `,
    [passwordHash, userId, contractorId],
  );

  // Get contractor name
  const contractorName =
    contractorData.contractor_type === "sube"
      ? `${contractorData.sube_first_name || ""} ${contractorData.sube_last_name || ""}`.trim()
      : contractorData.majur_society_name || "Contractor";

  // Send email
  const loginUrl = `${process.env.FRONTEND_URL}/login`;
  await sendContractorCredentials(
    contractorData.email,
    password,
    contractorName,
    loginUrl,
  );

  logger.info(
    `Credentials sent to contractor ${contractorId} (${contractorData.email}) by user ${userId}`,
  );

  return {
    success: true,
    message: "Credentials sent successfully",
    email: contractorData.email,
  };
};

const getStats = async () => {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
      COUNT(CASE WHEN contractor_type = 'majur' THEN 1 END) as majur_count,
      COUNT(CASE WHEN contractor_type = 'sube' THEN 1 END) as sube_count,
      COUNT(CASE WHEN email_sent = true THEN 1 END) as credentials_sent
    FROM iwms_contractor 
    WHERE status != 'deleted'
  `);

  return result.rows[0];
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  softDelete,
  sendCredentialsEmail,
  getStats,
};
