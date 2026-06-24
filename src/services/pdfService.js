import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PANEL DE CONTROL DE COORDENADAS PDF (Carta: 612 x 792 pts)
// Nota: En pdf-lib el origen de coordenadas (0,0) es la esquina INFERIOR IZQUIERDA.
const config = {
  pageSize: { width: 612, height: 792 },

  // Lado Izquierdo (Frente del Gafete)
  // QR: Se bajó el eje Y y se movió ligeramente a la derecha
  qr: { x: 43, y: 629, size: 52 },

  // Inscrito: Se movió a la derecha (eje X) y se ajustó el alto para el rectángulo
  inscrito: { x: 226, y: 650, width: 65, height: 75 },

  // Textos para el PDF de respaldo
  labels: {
    title: { y: 460, size: 16, color: rgb(0, 0.28, 0.52) },
    name: { y: 275, size: 13, color: rgb(0.13, 0.15, 0.16) },
    folio: { y: 255, size: 10, color: rgb(0.44, 0.5, 0.59) },
    sede: { y: 238, size: 10, color: rgb(0.11, 0.37, 0.65) }
  },

  // Lado Derecho (Personas Autorizadas)
  // Se subió drásticamente el eje Y para salir de los logos. Se ajustaron los anchos.
  // textX es el centro exacto (x + width/2)
  auth1: { x: 332, y: 670, width: 55, height: 65, textX: 350, textY: 659 },
  auth2: { x: 390, y: 670, width: 55, height: 65, textX: 415, textY: 659 },
  auth3: { x: 450, y: 670, width: 55, height: 65, textX: 470, textY: 659 }
};

/**
 * Transforms standard Google Drive view link to direct hotlink format
 */
const parseDriveImageUrl = (url) => {
  if (!url) return '';
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  }
  return url;
};

/**
 * Downloads image safely and returns ArrayBuffer. Returns null on failure.
 */
const downloadImage = async (url) => {
  if (!url || url.includes('mock-file') || url.includes('mock.com')) {
    console.log(`[PDF Service]: Skipping mock or invalid image URL: ${url}`);
    return null;
  }

  const parsedUrl = parseDriveImageUrl(url);
  try {
    console.log(`[PDF Service]: Downloading photo from: ${parsedUrl}`);
    const response = await axios.get(parsedUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error(`[PDF Service Warning]: Failed to download image from ${parsedUrl}:`, error.message);
    return null;
  }
};

/**
 * Embeds image buffer into PDF document supporting both JPG and PNG
 */
const embedImageSafely = async (pdfDoc, imageBuffer) => {
  if (!imageBuffer) return null;
  try {
    return await pdfDoc.embedJpg(imageBuffer);
  } catch (e) {
    try {
      return await pdfDoc.embedPng(imageBuffer);
    } catch (e2) {
      console.error('[PDF Service Error]: Failed to embed image as JPG or PNG:', e2.message);
      return null;
    }
  }
};

/**
 * Helper to draw centered text around a given X center coordinate
 */
const drawCenteredText = (page, text, font, size, xCenter, y, color) => {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: xCenter - width / 2,
    y,
    size,
    font,
    color
  });
};

/**
 * Main function to generate credential PDF buffer from profile data
 */
export const generateCredential = async (profileData) => {
  console.log(`[PDF Service]: Starting credential generation for folio: ${profileData.folio}`);

  let pdfDoc;
  let page;

  const templateFilename = profileData.sede === 'CEFID' ? 'plantilla_cefid.pdf' : 'plantilla_udu.pdf';
  const templatePath = path.join(__dirname, '../assets', templateFilename);

  if (fs.existsSync(templatePath)) {
    try {
      console.log(`[PDF Service]: Loading local template asset from: ${templatePath}`);
      const templateBuffer = await fs.promises.readFile(templatePath);
      pdfDoc = await PDFDocument.load(templateBuffer);
      page = pdfDoc.getPages()[0];
    } catch (err) {
      console.error(`[PDF Service Error]: Failed to load template PDF. Creating fallback:`, err.message);
    }
  }

  if (!pdfDoc) {
    console.log(`[PDF Service]: Template not found. Generating default blank fallback credential page.`);
    pdfDoc = await PDFDocument.create();
    page = pdfDoc.addPage([config.pageSize.width, config.pageSize.height]);

    page.drawRectangle({
      x: 0, y: 0, width: config.pageSize.width, height: config.pageSize.height, color: rgb(0.97, 0.98, 0.98),
    });
    page.drawRectangle({
      x: 0, y: 430, width: config.pageSize.width, height: 70, color: rgb(0.11, 0.37, 0.65),
    });
  }

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = page.getWidth();

  // 2. Generate and embed QR code
  const qrUrl = `https://veranofelinos.waimmersive.com/perfil/${profileData.folio}`;
  console.log(`[PDF Service]: Generating QR pointing to: ${qrUrl}`);
  const qrBuffer = await QRCode.toBuffer(qrUrl, { type: 'png', margin: 1 });
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  page.drawImage(qrImage, {
    x: config.qr.x, y: config.qr.y, width: config.qr.size, height: config.qr.size
  });

  // 3. Download and draw child/inscrito avatar
  if (profileData.fotoUrl) {
    const inscritoImageBuffer = await downloadImage(profileData.fotoUrl);
    const inscritoImage = await embedImageSafely(pdfDoc, inscritoImageBuffer);
    if (inscritoImage) {
      page.drawImage(inscritoImage, {
        x: config.inscrito.x, y: config.inscrito.y, width: config.inscrito.width, height: config.inscrito.height
      });
      page.drawRectangle({
        x: config.inscrito.x, y: config.inscrito.y, width: config.inscrito.width, height: config.inscrito.height,
        borderColor: rgb(1, 1, 1), borderWidth: 3, color: rgb(0, 0, 0), opacity: 0, borderOpacity: 1
      });
    }
  }

  const isFallbackPage = pdfDoc.getPages().length === 1 && !fs.existsSync(templatePath);
  if (isFallbackPage) {
    drawCenteredText(page, 'CREDENCIAL DIGITAL', fontHelveticaBold, config.labels.title.size, pageWidth / 2, config.labels.title.y, rgb(1, 1, 1));
    const fullName = `${profileData.nombre} ${profileData.paterno} ${profileData.materno}`.trim().toUpperCase();
    drawCenteredText(page, fullName, fontHelveticaBold, config.labels.name.size, pageWidth / 2, config.labels.name.y, config.labels.name.color);
    drawCenteredText(page, `FOLIO: ${profileData.folio}`, fontHelvetica, config.labels.folio.size, pageWidth / 2, config.labels.folio.y, config.labels.folio.color);
    drawCenteredText(page, `SEDE: ${profileData.sede}`, fontHelveticaBold, config.labels.sede.size, pageWidth / 2, config.labels.sede.y, config.labels.sede.color);
    drawCenteredText(page, 'PERSONAS AUTORIZADAS', fontHelveticaBold, 9, pageWidth / 2, 222, rgb(0.44, 0.5, 0.59));
  }

  // 4. Download and draw Authorized persons
  for (let i = 1; i <= 3; i++) {
    const authName = profileData[`auth${i}Nombre`] || profileData[`auth${i}_name`];
    const authPhotoUrl = profileData[`auth${i}FotoUrl`] || profileData[`auth${i}_photo_url`];
    const authConfig = config[`auth${i}`];

    if (!authName || !authName.trim()) continue;

    console.log(`[PDF Service]: Processing Authorized Person ${i}: ${authName}`);

    if (authPhotoUrl) {
      const authImageBuffer = await downloadImage(authPhotoUrl);
      const authImage = await embedImageSafely(pdfDoc, authImageBuffer);
      if (authImage) {
        page.drawImage(authImage, {
          x: authConfig.x, y: authConfig.y, width: authConfig.width, height: authConfig.height
        });
        page.drawRectangle({
          x: authConfig.x, y: authConfig.y, width: authConfig.width, height: authConfig.height,
          borderColor: rgb(1, 1, 1), borderWidth: 2, color: rgb(0, 0, 0), opacity: 0, borderOpacity: 1
        });
      }
    }

    const displayShortName = authName.split(' ')[0] + ' ' + (authName.split(' ')[1] || '');
    drawCenteredText(page, displayShortName, fontHelveticaBold, 8, authConfig.textX, authConfig.textY, rgb(0.13, 0.15, 0.16));
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`[PDF Service]: Generated credential PDF buffer successfully. Size: ${pdfBytes.length} bytes`);
  return Buffer.from(pdfBytes);
};