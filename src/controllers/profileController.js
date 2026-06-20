import { getRowByFolio } from '../services/googleSheetsService.js';

/**
 * Controller to handle digital profile rendering and management.
 */
export const getProfile = async (req, res) => {
  try {
    const { folio_id } = req.params;
    console.log(`[Profile Controller]: Fetching profile for folio: ${folio_id}`);
    const profile = await getRowByFolio(folio_id);

    return res.json({
      success: true,
      message: 'Profile data retrieved (stub)',
      data: profile
    });
  } catch (error) {
    console.error('[Profile Controller Error - getProfile]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: error.message
    });
  }
};

/**
 * Controller to render/serve data for the web editing portal.
 */
export const getEditPortal = async (req, res) => {
  try {
    const { folio_id } = req.params;
    console.log(`[Profile Controller]: Loading edit portal for folio: ${folio_id}`);
    const profile = await getRowByFolio(folio_id);

    return res.json({
      success: true,
      message: 'Edit portal details retrieved (stub)',
      data: profile
    });
  } catch (error) {
    console.error('[Profile Controller Error - getEditPortal]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve edit portal details',
      error: error.message
    });
  }
};

/**
 * Controller to process updated files and update sheets/drive.
 */
export const updateFiles = async (req, res) => {
  try {
    const { folio_id } = req.params;
    const { body, files } = req;
    console.log(`[Profile Controller]: Updating files for folio: ${folio_id}`, body);
    console.log(`[Profile Controller]: Files to update:`, files ? Object.keys(files) : []);

    // TODO: Process substitution of files in Google Drive and update Google Sheets

    return res.json({
      success: true,
      message: `Files updated successfully for folio: ${folio_id} (stub)`,
      data: {
        folioId: folio_id,
        filesUpdated: files ? Object.keys(files) : []
      }
    });
  } catch (error) {
    console.error('[Profile Controller Error - updateFiles]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update files',
      error: error.message
    });
  }
};
