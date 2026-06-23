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
 */
export const handleEnrollment = async (req, res) => {
  try {
    const { body, files } = req;

    // Extracción segura (Soporta tanto nombres en inglés como en español)
    const nombreInscrito = (body.nombreInscrito || body.child_name || '').trim();
    const childAge = parseInt(body.child_age || body.edad, 10);
    const sedeId = (body.sede || body.sede_id || 'UDU').trim();
    const childBirthDate = (body.child_birth_date || body.fechaNacimiento || '').trim();
    const childGender = (body.child_gender || body.sexo || '').trim();

    const tutorName = (body.tutor_name || body.nombreTutor || '').trim();
    const tutorPhone = (body.tutor_phone || body.telefonoContacto || '').trim();
    const tutorEmail = (body.tutor_email || body.correoElectronico || '').trim();

    const emergencyContactName = (body.emergency_contact_name || body.contactoEmergencia || '').trim();
    const emergencyContactPhone = (body.emergency_contact_phone || body.telefonoEmergencia || '').trim();

    // Extracción Médica
    const bloodType = (body.blood_type || body.tipoSangre || '').trim();
    const allergies = (body.allergies || body.medical_allergies || body.alergiasMedicas || 'Ninguna').trim();
    const medicalObservations = (body.medical_observations || body.padecimientos || 'Ninguna').trim();

    // Extracción de Autorizados
    const auth1Name = (body.auth1_name || body.auth1Nombre || '').trim();
    const auth1Phone = (body.auth1_phone || body.auth1Telefono || '').trim();
    const auth2Name = (body.auth2_name || body.auth2Nombre || '').trim();
    const auth2Phone = (body.auth2_phone || body.auth2Telefono || '').trim();
    const auth3Name = (body.auth3_name || body.auth3Nombre || '').trim();
    const auth3Phone = (body.auth3_phone || body.auth3Telefono || '').trim();

    // Validación Básica
    if (!nombreInscrito || !sedeId || !tutorName || !tutorEmail) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios en el formulario.'
      });
    }

    // Algoritmo Único y Seguro de Separación de Nombres
    const cleanedName = nombreInscrito.replace(/\s+/g, ' ');
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

    // Generar Folio
    const folioId = generateFolio(sedeId);
    console.log(`[Enrollment Controller]: Processing enrollment for ${nombreInscrito}. Assigned Folio: ${folioId}`);

    // Compresión Sharp
    if (files) {
      for (const fieldName in files) {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          if (file && file.mimetype && file.mimetype.startsWith('image/')) {
            try {
              console.log(`[Sharp Compressor]: Compressing image field '${fieldName}'`);
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

    // Subida a Google Drive
    let fileUrls = {};
    if (files) {
      fileUrls = await uploadEnrollmentFiles(folioId, sedeId, nombreInscrito, files);
    }

    // Construcción Exacta de la Fila (34 Elementos)
    const rowData = [
      sedeId,                                     // [0] Sede
      folioId,                                    // [1] Folio ID
      new Date().toISOString(),                   // [2] Fecha Registro
      childName,                                  // [3] Nombre(s)
      childLastName,                              // [4] Apellido Paterno
      childSecondLastName,                        // [5] Apellido Materno
      childGender,                                // [6] Sexo
      isNaN(childAge) ? "" : childAge,            // [7] Edad
      childBirthDate,                             // [8] Fecha Nacimiento
      tutorName,                                  // [9] Nombre Tutor
      tutorPhone,                                 // [10] Teléfono Tutor
      tutorEmail,                                 // [11] Correo Electrónico
      emergencyContactName,                       // [12] Contacto Emergencia
      emergencyContactPhone,                      // [13] Teléfono Emergencia
      allergies,                                  // [14] Alergias
      medicalObservations,                        // [15] Padecimientos
      bloodType,                                  // [16] Tipo Sangre
      auth1Name,                                  // [17] Auth 1 Nombre
      auth1Phone,                                 // [18] Auth 1 Tel
      fileUrls.auth1_photo || "",                 // [19] Auth 1 Foto URL
      auth2Name,                                  // [20] Auth 2 Nombre
      auth2Phone,                                 // [21] Auth 2 Tel
      fileUrls.auth2_photo || "",                 // [22] Auth 2 Foto URL
      auth3Name,                                  // [23] Auth 3 Nombre
      auth3Phone,                                 // [24] Auth 3 Tel
      fileUrls.auth3_photo || "",                 // [25] Auth 3 Foto URL
      fileUrls.child_photo || "",                 // [26] Foto Inscrito URL
      fileUrls.doc_curp || "",                    // [27] CURP URL
      fileUrls.doc_ine || "",                     // [28] INE URL
      "",                                         // [29] Perfil Virtual URL
      "",                                         // [30] Portal Edición Web
      "Pendiente",                                // [31] Estatus Registro (Obligatorio para correo)
      "",                                         // [32] Log Generación PDF
      ""                                          // [33] Enlace Credencial PDF
    ];

    // Llamada al servicio de Google Sheets
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