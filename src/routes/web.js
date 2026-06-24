import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProfile, getEditPortal } from '../controllers/profileController.js';
import { generateAndSaveCredential } from '../controllers/pdfController.js';
import { updateProfile } from '../controllers/editController.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Web Route: Onboarding form wizard view
router.get('/enroll', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/enroll.html'));
});

// Redirect root to enrollment page
router.get('/', (req, res) => {
  res.redirect('/enroll');
});

// Web Route: View participant profile in real time
router.get('/perfil/:folio_id', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/profile.html'));
});

const renderEditPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/edit.html'));
};

// Web Route: Participant file updating portal
router.get('/editar/:folio', renderEditPage);

// Alias API Route (direct root mapping)
router.get('/api/profile/:folio', getProfile);
router.post('/api/generate-pdf/:folio', generateAndSaveCredential);
router.put('/api/editar/:folio', updateProfile);

export default router;

