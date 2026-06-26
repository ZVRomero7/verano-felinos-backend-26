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
  qr: { x: 40, y: 643, size: 55 }, // x - 5, y + 5, size - 5%
  fotoInscrito: { x: 200, y: 645, width: 75, height: 90 },
  textosInscrito: {
    xNombre: 60, // x - 15 - 10
    yNombre: 607, // Emparejado con el Y de los nombres de autorizados
    xContacto: 90, // Movido 20 puntos menos
    xTelefono: 240, // Movido 30 puntos a la izquierda para evitar superposición
    yEmergencia: 583,
    sizeNombre: 14,
    maxWidthNombre: 220
  },
  autorizados: {
    startX: 310, // Alineado a la izquierda con el primer recuadro
    yFoto: 630,
    width: 95, // Reducido un 5% para que encaje en las cajas
    height: 120,
    gap: 4, // Ajustado ligeramente para distribuir el nuevo tamaño
    yNombre: 606,
    yTelefono: 583,
    sizeBase: 9
  },
  labels: {
    title: { y: 460, size: 16, color: rgb(0, 0.28, 0.52) },
    name: { y: 275, size: 13, color: rgb(0.13, 0.15, 0.16) },
    folio: { y: 255, size: 10, color: rgb(0.44, 0.5, 0.59) },
    sede: { y: 238, size: 10, color: rgb(0.11, 0.37, 0.65) }
  }
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
    x: config.qr?.x || 70,
    y: config.qr?.y || 603,
    width: config.qr?.size || 72,
    height: config.qr?.size || 72
  });

  // 3. Download and draw child/inscrito avatar
  if (profileData.fotoUrl) {
    const inscritoImageBuffer = await downloadImage(profileData.fotoUrl);
    const inscritoImage = await embedImageSafely(pdfDoc, inscritoImageBuffer);
    if (inscritoImage) {
      const fx = config.fotoInscrito?.x || 215;
      const fy = config.fotoInscrito?.y || 603;
      const fw = config.fotoInscrito?.width || 80;
      const fh = config.fotoInscrito?.height || 108;
      page.drawImage(inscritoImage, {
        x: fx, y: fy, width: fw, height: fh
      });
      page.drawRectangle({
        x: fx, y: fy, width: fw, height: fh,
        borderColor: rgb(1, 1, 1), borderWidth: 3, color: rgb(0, 0, 0), opacity: 0, borderOpacity: 1
      });
    }
  }

  // 4. Draw child's name, age, emergency contact name and phone (Lado Derecho)
  const nombre = profileData.nombre || '';
  const paterno = profileData.paterno || '';
  const edadValue = profileData.edad || '8';

  const nombreCompletoConEdad = `${nombre} ${paterno} - ${edadValue} AÑOS`.trim().toUpperCase();

  let sizeNombre = config.textosInscrito?.sizeNombre || 14;
  const maxWidthNombre = config.textosInscrito?.maxWidthNombre || 220;

  let anchoTotal = fontHelveticaBold.widthOfTextAtSize(nombreCompletoConEdad, sizeNombre);
  if (anchoTotal > maxWidthNombre) {
    const scaleFactor = maxWidthNombre / anchoTotal;
    sizeNombre *= scaleFactor;
  }

  const dx = config.textosInscrito?.xNombre || 90;
  const dyNombre = config.textosInscrito?.yNombre || 577;
  page.drawText(nombreCompletoConEdad, {
    x: dx,
    y: dyNombre,
    size: sizeNombre,
    font: fontHelveticaBold,
    color: rgb(0, 0, 0)
  });

  // Extract and draw Emergency Contact name and phone next to their labels
  const emergencyContactName = (profileData.emergencyContactName || profileData.contactoEmergencia || '').trim().toUpperCase();
  const emergencyContactPhone = (profileData.emergencyContactPhone || profileData.telefonoEmergencia || '').trim();

  const xContacto = config.textosInscrito?.xContacto || 145;
  const xTelefono = config.textosInscrito?.xTelefono || 350;
  const yEmergencia = config.textosInscrito?.yEmergencia || 553;
  const sizeBaseEmergencia = config.autorizados?.sizeBase || 9;

  if (emergencyContactName) {
    page.drawText(emergencyContactName, {
      x: xContacto,
      y: yEmergencia,
      size: sizeBaseEmergencia,
      font: fontHelveticaBold,
      color: rgb(0.13, 0.15, 0.16)
    });
  }

  if (emergencyContactPhone) {
    page.drawText(emergencyContactPhone, {
      x: xTelefono,
      y: yEmergencia,
      size: sizeBaseEmergencia,
      font: fontHelvetica,
      color: rgb(0.13, 0.15, 0.16)
    });
  }

  const isFallbackPage = pdfDoc.getPages().length === 1 && !fs.existsSync(templatePath);
  if (isFallbackPage) {
    const titleSize = config.labels?.title?.size || 16;
    const titleY = config.labels?.title?.y || 460;
    const titleColor = config.labels?.title?.color || rgb(0, 0.28, 0.52);
    drawCenteredText(page, 'CREDENCIAL DIGITAL', fontHelveticaBold, titleSize, pageWidth / 2, titleY, titleColor);

    const fullName = `${profileData.nombre} ${profileData.paterno} ${profileData.materno}`.trim().toUpperCase();
    const nameSize = config.labels?.name?.size || 13;
    const nameY = config.labels?.name?.y || 275;
    const nameColor = config.labels?.name?.color || rgb(0.13, 0.15, 0.16);
    drawCenteredText(page, fullName, fontHelveticaBold, nameSize, pageWidth / 2, nameY, nameColor);

    const folioSize = config.labels?.folio?.size || 10;
    const folioY = config.labels?.folio?.y || 255;
    const folioColor = config.labels?.folio?.color || rgb(0.44, 0.5, 0.59);
    drawCenteredText(page, `FOLIO: ${profileData.folio}`, fontHelvetica, folioSize, pageWidth / 2, folioY, folioColor);

    const sedeSize = config.labels?.sede?.size || 10;
    const sedeY = config.labels?.sede?.y || 238;
    const sedeColor = config.labels?.sede?.color || rgb(0.11, 0.37, 0.65);
    drawCenteredText(page, `SEDE: ${profileData.sede}`, fontHelveticaBold, sedeSize, pageWidth / 2, sedeY, sedeColor);

    drawCenteredText(page, 'PERSONAS AUTORIZADAS', fontHelveticaBold, 9, pageWidth / 2, 222, rgb(0.44, 0.5, 0.59));
  }

  // 5. Download and draw Authorized persons dynamically from left to right (top-right row)
  const activeAuths = [];
  for (let i = 1; i <= 3; i++) {
    const name = profileData[`auth${i}Nombre`] || profileData[`auth${i}_name`];
    const photo = profileData[`auth${i}FotoUrl`] || profileData[`auth${i}_photo_url`];
    const phone = profileData[`auth${i}Telefono`] || profileData[`auth${i}_phone`];
    if (name && name.trim()) {
      activeAuths.push({ name, photo, phone });
    }
  }

  let currentX = config.autorizados?.startX || 322;

  for (let index = 0; index < activeAuths.length; index++) {
    const auth = activeAuths[index];

    console.log(`[PDF Service]: Rendering Authorized Person ${index + 1}: ${auth.name} at x: ${currentX}`);

    const ayFoto = config.autorizados?.yFoto || 603;
    const aw = config.autorizados?.width || 73;
    const ah = config.autorizados?.height || 105;

    if (auth.photo) {
      const authImageBuffer = await downloadImage(auth.photo);
      const authImage = await embedImageSafely(pdfDoc, authImageBuffer);
      if (authImage) {
        page.drawImage(authImage, {
          x: currentX, y: ayFoto, width: aw, height: ah
        });
        page.drawRectangle({
          x: currentX, y: ayFoto, width: aw, height: ah,
          borderColor: rgb(1, 1, 1), borderWidth: 2, color: rgb(0, 0, 0), opacity: 0, borderOpacity: 1
        });
      }
    }

    const displayShortName = auth.name.split(' ')[0] + ' ' + (auth.name.split(' ')[1] || '');

    const sizeBase = config.autorizados?.sizeBase || 9;
    const maxWidthAuth = aw + 5;
    let textWidth = fontHelveticaBold.widthOfTextAtSize(displayShortName, sizeBase);
    let tamañoFinal = sizeBase;

    if (textWidth > maxWidthAuth) {
      const scaleFactor = maxWidthAuth / textWidth;
      tamañoFinal = sizeBase * scaleFactor;
      textWidth = fontHelveticaBold.widthOfTextAtSize(displayShortName, tamañoFinal);
    }

    const textStartX = (currentX + aw / 2) - (textWidth / 2);
    const ayNombre = config.autorizados?.yNombre || 577;

    page.drawText(displayShortName, {
      x: textStartX,
      y: ayNombre,
      size: tamañoFinal,
      font: fontHelveticaBold,
      color: rgb(0.13, 0.15, 0.16)
    });

    // Draw phone number
    const phoneText = (auth.phone || '').trim();
    if (phoneText) {
      const phoneWidth = fontHelvetica.widthOfTextAtSize(phoneText, sizeBase);
      const phoneStartX = (currentX + aw / 2) - (phoneWidth / 2);
      const ayTelefono = config.autorizados?.yTelefono || 553;
      page.drawText(phoneText, {
        x: phoneStartX,
        y: ayTelefono,
        size: sizeBase,
        font: fontHelvetica,
        color: rgb(0.13, 0.15, 0.16)
      });
    }

    currentX += aw + (config.autorizados?.gap || 12);
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`[PDF Service]: Generated credential PDF buffer successfully. Size: ${pdfBytes.length} bytes`);
  return Buffer.from(pdfBytes);
};