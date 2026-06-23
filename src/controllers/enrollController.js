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

    const folio = folioId;
    const nombresExtraidos = childName;
    const paternoExtraido = childLastName;
    const maternoExtraido = childSecondLastName;
    const urls = fileUrls;

    const rowData = [
      req.body.sede || req.body.sede_id || "",                      // [0] Sede ID
      folio,                                    // [1] Folio ID
      new Date().toISOString(),                 // [2] Fecha Registro
      nombresExtraidos || "",                   // [3] Nombre(s) del Menor
      paternoExtraido || "",                    // [4] Apellido Paterno
      maternoExtraido || "",                    // [5] Apellido Materno
      req.body.sexo || req.body.child_gender || "",                      // [6] Sexo
      req.body.edad || req.body.child_age || "",                      // [7] Edad
      req.body.fechaNacimiento || req.body.child_birth_date || "",           // [8] Fecha Nacimiento
      req.body.nombreTutor || req.body.tutor_name || "",               // [9] Nombre del Tutor
      req.body.telefonoContacto || req.body.tutor_phone || "",          // [10] Teléfono del Tutor
      req.body.correoElectronico || req.body.tutor_email || "",         // [11] Correo Electrónico
      req.body.contactoEmergencia || req.body.emergency_contact_name || "",        // [12] Contacto Emergencia
      req.body.telefonoEmergencia || req.body.emergency_contact_phone || "",        // [13] Teléfono Emergencia
      req.body.alergiasMedicas || (Array.isArray(allergies) ? allergies.join(', ') : allergies) || "",           // [14] Alergias / Datos Médicos
      req.body.padecimientos || req.body.medical_observations || "",             // [15] Padecimientos Crónicos
      req.body.tipoSangre || req.body.blood_type || "",                // [16] Tipo Sangre
      req.body.auth1Nombre || req.body.auth1_name || "",               // [17] Auth 1 Nombre
      req.body.auth1Telefono || req.body.auth1_phone || "",             // [18] Auth 1 Teléfono
      urls.auth1_photo || "",                   // [19] Auth 1 Foto URL
      req.body.auth2Nombre || req.body.auth2_name || "",               // [20] Auth 2 Nombre
      req.body.auth2Telefono || req.body.auth2_phone || "",             // [21] Auth 2 Teléfono
      urls.auth2_photo || "",                   // [22] Auth 2 Foto URL
      req.body.auth3Nombre || req.body.auth3_name || "",               // [23] Auth 3 Nombre
      req.body.auth3Telefono || req.body.auth3_phone || "",             // [24] Auth 3 Teléfono
      urls.auth3_photo || "",                   // [25] Auth 3 Foto URL
      urls.child_photo || "",                   // [26] Inscrito Foto URL
      urls.doc_curp || "",                      // [27] Documento CURP URL
      urls.doc_ine || "",                       // [28] Documento INE URL
      "",                                       // [29] Perfil Virtual URL
      "",                                       // [30] Portal Edición Web
      "Pendiente",                              // [31] Estatus Registro (Columna AF)
      "",                                       // [32] Log Generación PDF
      ""                                        // [33] Enlace Credencial PDF
    ];

    // Call Google Sheets Service to append row
    await appendEnrollmentRow(rowData);

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
