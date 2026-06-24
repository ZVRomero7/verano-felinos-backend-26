import express from 'express';
import multer from 'multer';
import { handleEnrollment } from '../controllers/enrollController.js';
import { getProfile, updateFiles } from '../controllers/profileController.js';
import { generateAndSaveCredential } from '../controllers/pdfController.js';
import { updateProfile } from '../controllers/editController.js';

const router = express.Router();

// Multer memory storage is ideal for streaming to Google Drive without holding files on local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB file limit
  }
});

// Allow upload fields (child photo, documentation, and photos for the 3 authorized persons)
const uploadFields = upload.fields([
  { name: 'child_photo', maxCount: 1 },
  { name: 'doc_curp', maxCount: 1 },
  { name: 'doc_ine', maxCount: 1 },
  { name: 'auth1_photo', maxCount: 1 },
  { name: 'auth2_photo', maxCount: 1 },
  { name: 'auth3_photo', maxCount: 1 }
]);

// API Route: Enrollment submission
router.post('/enroll', uploadFields, handleEnrollment);

// API Route: Get participant profile by folio
router.get('/profile/:folio', getProfile);

// API Route: Update files for a specific enrollment folio
router.put('/edit/:folio_id', uploadFields, updateFiles);

// API Route: Generate and save participant PDF credential
router.post('/generate-pdf/:folio', generateAndSaveCredential);

// API Route: Update participant profile text details
router.put('/editar/:folio', updateProfile);

export default router;

