import express from 'express';
import multer from 'multer';
import { handleEnrollment } from '../controllers/enrollController.js';
import { updateFiles } from '../controllers/profileController.js';

const router = express.Router();

// Multer memory storage is ideal for streaming to Google Drive without holding files on local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB file limit
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

// API Route: Update files for a specific enrollment folio
router.put('/edit/:folio_id', uploadFields, updateFiles);

export default router;
