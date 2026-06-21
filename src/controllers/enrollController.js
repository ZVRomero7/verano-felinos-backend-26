import { uploadEnrollmentFiles } from '../services/googleDriveService.js';
import { appendEnrollmentRow } from '../services/googleSheetsService.js';

/**
 * Generates a unique folio ID for the participant.
 * Format: VF-26-[RANDOM_5_DIGITS]
 */
const generateFolio = () => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `VF-26-${randomNum}`;
};

/**
 * Handles participant enrollment requests.
 * Expects multipart/form-data with texts and up to 6 binary files.
 */
export const handleEnrollment = async (req, res) => {
  try {
    const { body, files } = req;
    
    // Extract participant and tutor details
    const childName = body.child_name?.trim();
    const childAge = parseInt(body.child_age, 10);
    const sedeId = body.sede_id?.trim();
    const tutorName = body.tutor_name?.trim();
    const tutorPhone = body.tutor_phone?.trim();
    const tutorEmail = body.tutor_email?.trim();
    
    // Extract medical info
    const bloodType = body.blood_type?.trim();
    const allergies = body.allergies || 'Ninguna';
    const medicalObservations = body.medical_observations?.trim() || 'Ninguna';
    
    // Extract authorized guardians info
    const auth1Name = body.auth1_name?.trim();
    const auth1Phone = body.auth1_phone?.trim();
    
    const auth2Name = body.auth2_name?.trim();
    const auth2Phone = body.auth2_phone?.trim();
    
    const auth3Name = body.auth3_name?.trim();
    const auth3Phone = body.auth3_phone?.trim();

    // Basic fields validation
    if (!childName || isNaN(childAge) || !sedeId || !tutorName || !tutorPhone || !tutorEmail || !bloodType) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios en el formulario.'
      });
    }

    // Generate folio and timestamp
    const folioId = generateFolio();
    const timestamp = new Date().toISOString();

    console.log(`[Enrollment Controller]: Processing enrollment for ${childName}. Assigned Folio: ${folioId}`);

    // Call Google Drive Service to create folder and upload files
    let fileUrls = {};
    if (files) {
      fileUrls = await uploadEnrollmentFiles(folioId, sedeId, childName, files);
    }

    // Prepare Sheets row data
    const enrollmentData = {
      folioId,
      timestamp,
      sedeId,
      childName,
      childAge,
      tutorName,
      tutorPhone,
      tutorEmail,
      bloodType,
      allergies: Array.isArray(allergies) ? allergies.join(', ') : allergies,
      medicalObservations,
      docCurpUrl: fileUrls.doc_curp || '',
      docIneUrl: fileUrls.doc_ine || '',
      childPhotoUrl: fileUrls.child_photo || '',
      auth1Name,
      auth1Phone,
      auth1PhotoUrl: fileUrls.auth1_photo || '',
      auth2Name,
      auth2Phone,
      auth2PhotoUrl: fileUrls.auth2_photo || '',
      auth3Name,
      auth3Phone,
      auth3PhotoUrl: fileUrls.auth3_photo || '',
      status: 'Pendiente'
    };

    // Call Google Sheets Service to append row
    await appendEnrollmentRow(enrollmentData);

    return res.status(201).json({
      success: true,
      message: 'Inscripción procesada y registrada exitosamente.',
      data: {
        folioId,
        childName,
        status: 'Pendiente',
        filesUploadedCount: Object.keys(fileUrls).length
      }
    });

  } catch (error) {
    console.error('[Enrollment Controller Error]:', error);
    return res.status(500).json({
      error: error.message
    });
  }
};
