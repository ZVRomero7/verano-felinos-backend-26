import { uploadEnrollmentFiles } from '../services/googleDriveService.js';
import { appendEnrollmentRow } from '../services/googleSheetsService.js';
import sharp from 'sharp';
import path from 'path';

/**
 * Generates a unique folio ID for the participant.
 * Format: ${sede}-26-[RANDOM_5_DIGITS]
 */
const generateFolio = (sede) => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${sede}-26-${randomNum}`;
};

/**
 * Handles participant enrollment requests.
 * Expects multipart/form-data with texts and up to 6 binary files.
 */
export const handleEnrollment = async (req, res) => {
  try {
    const { body, files } = req;
    
    // Extract participant and tutor details
    const nombreInscrito = body.nombreInscrito?.trim();
    const childAge = parseInt(body.child_age, 10);
    const sedeId = (body.sede || body.sede_id)?.trim();
    const childBirthDate = body.child_birth_date?.trim();
    const childGender = body.child_gender?.trim();
    
    const tutorName = body.tutor_name?.trim();
    const tutorPhone = body.tutor_phone?.trim();
    const tutorEmail = body.tutor_email?.trim();
    
    const emergencyContactName = body.emergency_contact_name?.trim();
    const emergencyContactPhone = body.emergency_contact_phone?.trim();
    
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
    if (!nombreInscrito || isNaN(childAge) || !sedeId || !childBirthDate || !childGender || !tutorName || !tutorPhone || !tutorEmail || !emergencyContactName || !emergencyContactPhone || !bloodType) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios en el formulario.'
      });
    }

    // Name splitting algorithm
    const cleanedName = nombreInscrito.replace(/\s+/g, ' ');
    const nameWords = cleanedName.split(' ');
    let childName = '';
    let childLastName = '';
    let childSecondLastName = '';

    if (nameWords.length >= 4) {
      childSecondLastName = nameWords.pop();
      childLastName = nameWords.pop();
      childName = nameWords.join(' ');
    } else if (nameWords.length === 3) {
      childName = nameWords[0];
      childLastName = nameWords[1];
      childSecondLastName = nameWords[2];
    } else if (nameWords.length === 2) {
      childName = nameWords[0];
      childLastName = nameWords[1];
      childSecondLastName = '';
    } else {
      childName = nameWords[0] || '';
      childLastName = '';
      childSecondLastName = '';
    }

    // Generate folio and timestamp
    const folioId = generateFolio(sedeId);
    const timestamp = new Date().toISOString();

    console.log(`[Enrollment Controller]: Processing enrollment for ${nombreInscrito}. Assigned Folio: ${folioId}`);

    // Compress image uploads on-the-fly using sharp
    if (files) {
      for (const fieldName in files) {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          if (file && file.mimetype && file.mimetype.startsWith('image/')) {
            try {
              console.log(`[Sharp Compressor]: Compressing image field '${fieldName}' (${file.originalname}, initial size: ${file.size} bytes)`);
              const compressedBuffer = await sharp(file.buffer)
                .resize({ width: 1200, withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
              
              file.buffer = compressedBuffer;
              file.size = compressedBuffer.length;
              file.mimetype = 'image/jpeg';
              
              const ext = path.extname(file.originalname);
              const base = path.basename(file.originalname, ext);
              file.originalname = `${base}.jpg`;
              
              console.log(`[Sharp Compressor]: Compressed successfully. New size: ${file.size} bytes`);
            } catch (sharpError) {
              console.error(`[Sharp Compressor Error] Failed to compress image ${file.originalname}:`, sharpError.message);
              return res.status(400).json({
                success: false,
                error: `Error al procesar la imagen del campo '${fieldName}': ${sharpError.message}`
              });
            }
          }
        }
      }
    }

    // Call Google Drive Service to create folder and upload files
    let fileUrls = {};
    if (files) {
      fileUrls = await uploadEnrollmentFiles(folioId, sedeId, nombreInscrito, files);
    }

    // Prepare Sheets row data
    const enrollmentData = {
      folioId,
      timestamp,
      sedeId,
      childName,
      childLastName,
      childSecondLastName,
      childGender,
      childAge,
      childBirthDate,
      tutorName,
      tutorPhone,
      tutorEmail,
      emergencyContactName,
      emergencyContactPhone,
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
        childName: nombreInscrito,
        status: 'Pendiente',
        filesUploadedCount: Object.keys(fileUrls).length
      }
    });

  } catch (error) {
    console.error('[Enrollment Controller Error]:', error);
    return res.status(400).json({
      error: error.message
    });
  }
};
