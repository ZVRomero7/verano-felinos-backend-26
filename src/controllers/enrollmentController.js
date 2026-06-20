import { uploadFileToDrive } from '../services/googleDriveService.js';
import { appendToSheet } from '../services/googleSheetsService.js';

/**
 * Controller to handle enrollment form submissions.
 */
export const handleEnrollment = async (req, res) => {
  try {
    const { body, files } = req;
    console.log('[Enrollment Controller]: Enrollment request body:', body);
    console.log('[Enrollment Controller]: Enrollment files received:', files ? Object.keys(files) : []);

    // 1. Upload files to Google Drive (stub)
    const fileUrls = {};
    if (files) {
      for (const fieldName in files) {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const uploadResult = await uploadFileToDrive(file, 'mock-drive-folder-id');
          fileUrls[fieldName] = uploadResult.webViewLink;
        }
      }
    }

    // 2. Save data to Google Sheets (stub)
    const folioId = `VF-${Date.now()}`;
    const rowData = {
      folioId,
      ...body,
      ...fileUrls,
      timestamp: new Date().toISOString()
    };
    await appendToSheet(rowData);

    return res.status(201).json({
      success: true,
      message: 'Enrollment processed successfully (stub)',
      data: {
        folioId,
        filesUploaded: Object.keys(fileUrls)
      }
    });
  } catch (error) {
    console.error('[Enrollment Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process enrollment',
      error: error.message
    });
  }
};
