import { getEnrollmentByFolio, updateRowPdfLink } from '../services/googleSheetsService.js';
import { generateCredential } from '../services/pdfService.js';
import { uploadCredentialPdf, getFolderIdFromProfile } from '../services/googleDriveService.js';

/**
 * Controller to handle credential generation, Drive upload, and Sheets row update.
 */
export const generateAndSaveCredential = async (req, res) => {
  try {
    const { folio } = req.params;
    console.log(`[PDF Controller]: Received PDF generation request for folio: ${folio}`);

    // 1. Fetch participant profile data
    const profileData = await getEnrollmentByFolio(folio);
    if (!profileData) {
      return res.status(404).json({
        success: false,
        error: 'Folio no encontrado'
      });
    }

    // 2. Generate PDF badge buffer
    const pdfBuffer = await generateCredential(profileData);

    // 3. Extract Drive folder ID and upload PDF buffer to Google Drive (Dual upload: individual folder and master folder)
    const folderId = await getFolderIdFromProfile(profileData);
    console.log(`[PDF Controller]: Extracted folderId for folio ${folio}:`, folderId);
    const childFullName = `${profileData.nombre} ${profileData.paterno} ${profileData.materno}`.trim();
    
    const masterFolderId = '1Qj6Z6BMC2BnkIvXYiKBhDkPQoFaa53yF';
    const [pdfUrl] = await Promise.all([
      uploadCredentialPdf(folio, profileData.sede, childFullName, pdfBuffer, folderId),
      uploadCredentialPdf(folio, profileData.sede, childFullName, pdfBuffer, masterFolderId).catch(err => {
        console.error(`[PDF Controller Warning]: Failed to upload copy to master folder (${masterFolderId}):`, err.message);
        return null;
      })
    ]);

    // 4. Update Google Sheets database (AG & AH columns)
    const logText = `Generado el ${new Date().toISOString()}`;
    await updateRowPdfLink(folio, pdfUrl, logText);

    // 5. Return success and the final PDF Drive link
    return res.status(200).json({
      success: true,
      pdfUrl
    });

  } catch (error) {
    console.error('[PDF Controller Error - generateAndSaveCredential]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate and save PDF credential',
      error: error.message
    });
  }
};
