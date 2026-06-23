import { uploadEnrollmentFiles } from '../services/googleDriveService.js';
import { appendEnrollmentRow } from '../services/googleSheetsService.js';
import sharp from 'sharp';
import path from 'path';

const generateFolio = (sede) => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${sede}-26-${randomNum}`;
};

export const handleEnrollment = async (req, res) => {
  try {
    const { body, files } = req;

    // 1. Extracción con tus variables originales correctas
    const nombreInscrito = body.nombreInscrito?.trim() || body.child_name?.trim();
    const childAge = parseInt(body.child_age || body.edad, 10);
    const sedeId = (body.sede || body.sede_id)?.trim() || 'UDU';
    const childBirthDate = body.child_birth_date?.trim();
    const childGender = body.child_gender?.trim();

    const tutorName = body.tutor_name?.trim();
    const tutorPhone = body.tutor_phone?.trim();
    const tutorEmail = body.tutor_email?.trim();

    const emergencyContactName = body.emergency_contact_name?.trim();
    const emergencyContactPhone = body.emergency_contact_phone?.trim();

    const bloodType = body.blood_type?.trim();
    const allergies = body.allergies?.trim() || 'Ninguna';
    const medicalObservations = body.medical_observations?.trim() || 'Ninguna';

    const auth1Name = body.auth1_name?.trim();
    const auth1Phone = body.auth1_phone?.trim();
    const auth2Name = body.auth2_name?.trim();
    const auth2Phone = body.auth2_phone?.trim();
    const auth3Name = body.auth3_name?.trim();
    const auth3Phone = body.auth3_phone?.trim();

    // 2. Algoritmo de Separación de Nombres
    const cleanedName = (nombreInscrito || '').trim().replace(/\s+/g, ' ');
    const nameWords = cleanedName ? cleanedName.split(' ') : [];
    let childName = '', childLastName = '', childSecondLastName = '';

    if (nameWords.length >= 4) {
      childSecondLastName = nameWords.pop();
      childLastName = nameWords.pop();
      childName = nameWords.join(' ');
    } else if (nameWords.length === 3) {
      childSecondLastName = nameWords.pop();
      childLastName = nameWords.pop();
      childName = nameWords.join(' ');
    } else if (nameWords.length === 2) {
      childLastName = nameWords.pop();
      childName = nameWords.join(' ');
    } else {
      childName = nameWords.join(' ');
    }

    const folioId = generateFolio(sedeId);
    console.log(`[Enrollment Controller]: Processing enrollment for ${nombreInscrito}. Assigned Folio: ${folioId}`);

    // 3. Compresión Sharp
    if (files) {
      for (const fieldName in files) {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          if (file && file.mimetype && file.mimetype.startsWith('image/')) {
            try {
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
            } catch (sharpError) {
              console.error(`[Sharp Compressor Error]:`, sharpError.message);
            }
          }
        }
      }
    }

    // 4. Subida a Google Drive
    let fileUrls = {};
    if (files) {
      fileUrls = await uploadEnrollmentFiles(folioId, sedeId, nombreInscrito, files);
    }

    // 5. Mapeo Exacto y Blindado a 34 Elementos
    const rowData = [
      sedeId,                               // [0]
      folioId,                              // [1]
      new Date().toISOString(),             // [2]
      childName || "",                      // [3]
      childLastName || "",                  // [4]
      childSecondLastName || "",            // [5]
      childGender || "",                    // [6]
      isNaN(childAge) ? "" : childAge,      // [7]
      childBirthDate || "",                 // [8]
      tutorName || "",                      // [9]
      tutorPhone || "",                     // [10]
      tutorEmail || "",                     // [11]
      emergencyContactName || "",           // [12]
      emergencyContactPhone || "",          // [13]
      allergies || "Ninguna",               // [14]
      medicalObservations || "Ninguna",     // [15]
      bloodType || "",                      // [16]
      auth1Name || "",                      // [17]
      auth1Phone || "",                     // [18]
      fileUrls.auth1_photo || "",           // [19]
      auth2Name || "",                      // [20]
      auth2Phone || "",                     // [21]
      fileUrls.auth2_photo || "",           // [22]
      auth3Name || "",                      // [23]
      auth3Phone || "",                     // [24]
      fileUrls.auth3_photo || "",           // [25]
      fileUrls.child_photo || "",           // [26]
      fileUrls.doc_curp || "",              // [27]
      fileUrls.doc_ine || "",               // [28]
      "",                                   // [29] Perfil Virtual
      "",                                   // [30] Portal Edición
      "Pendiente",                          // [31] Estatus Registro
      "",                                   // [32] Log
      ""                                    // [33] PDF Final
    ];

    await appendEnrollmentRow(rowData);

    return res.status(201).json({
      success: true,
      message: 'Inscripción procesada exitosamente.',
      data: { folioId, childName: nombreInscrito, status: 'Pendiente' }
    });

  } catch (error) {
    console.error('[Enrollment Controller Error]:', error);
    return res.status(400).json({ error: error.message });
  }
};