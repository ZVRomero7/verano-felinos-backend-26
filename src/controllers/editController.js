import { updateRowByFolio } from '../services/googleSheetsService.js';

/**
 * Controller to handle updating participant details.
 */
export const updateProfile = async (req, res) => {
  try {
    const folio = req.params.folio || req.params.folio_id;
    const updatedData = req.body;

    console.log(`[Edit Controller]: Request to update profile for folio: ${folio}`, updatedData);

    if (!folio) {
      return res.status(400).json({
        success: false,
        error: 'Folio ID is required'
      });
    }

    // Call Sheets Service to update row
    await updateRowByFolio(folio, updatedData);

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error('[Edit Controller Error - updateProfile]:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
