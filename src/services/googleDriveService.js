import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Google Workspace Drive Root ID dynamically from environment variables
const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_ID || '1NaiQdN_Pxqg0ALWtTK_hED5uke6QG18o';

/**
 * Instantiates the Google Drive client. Returns null if credentials are not configured.
 */
const getDriveClient = () => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    return { drive, auth: oauth2Client };
  } catch (error) {
    console.error('[Google Drive Auth Error]:', error.message);
    return null;
  }
};

/**
 * Uploads a single file buffer to Google Drive inside a specified folder.
 */
const uploadSingleFile = async (drive, file, folderId, auth) => {
  const fileMetadata = {
    name: file.originalname,
    parents: [folderId]
  };
  const media = {
    mimeType: file.mimetype,
    body: Readable.from(file.buffer)
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
    auth
  });

  // Make the file publicly readable so it can be displayed in profiles/portals
  try {
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      auth
    });
  } catch (permError) {
    console.error(`[Google Drive Service] Warning: Failed to share file ${file.originalname}:`, permError.message);
  }

  return response.data.webViewLink;
};

/**
 * Creates a dynamic folder path: Root -> [sedeId] -> [folio] - [childName]
 * and uploads all provided files.
 * 
 * @param {string} folio - Unique identifier
 * @param {string} sedeId - Selected campus ID
 * @param {string} childName - Participant's name
 * @param {Object} files - Dictionary of Multer files
 * @returns {Promise<Object>} File fieldnames mapped to their Drive URLs
 */
export const uploadEnrollmentFiles = async (folio, sedeId, childName, files) => {
  const clientData = getDriveClient();
  const fileUrls = {};

  // If Drive credentials are not set, run in Mock mode
  if (!clientData) {
    console.log(`\n☁️  [Google Drive Mock Mode]: Folder creation simulation`);
    console.log(`📁 Target Root: ${rootFolderId}`);
    console.log(`📂 Creating Sede Folder: "${sedeId}"`);
    console.log(`📂 Creating Child Folder: "${folio} - ${childName}"`);

    for (const fieldName in files) {
      const file = files[fieldName][0];
      const mockUrl = `https://drive.google.com/mock-file/${folio}/${fieldName}_${file.originalname}`;
      console.log(`📤 Uploading file [${fieldName}]: "${file.originalname}" (${file.size} bytes) -> URL: ${mockUrl}`);
      fileUrls[fieldName] = mockUrl;
    }
    console.log(`☁️  [Google Drive Mock Mode]: Completed upload simulation.\n`);
    return fileUrls;
  }

  const { drive, auth } = clientData;

  try {
    // 1. Find or create the Sede folder
    let sedeFolderId;
    const sedeSearch = await drive.files.list({
      q: `name = '${sedeId}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      auth
    });

    if (sedeSearch.data.files && sedeSearch.data.files.length > 0) {
      sedeFolderId = sedeSearch.data.files[0].id;
      console.log(`[Google Drive Service]: Found existing folder for Sede ${sedeId}: ${sedeFolderId}`);
    } else {
      const sedeMetadata = {
        name: sedeId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId]
      };
      const newSedeFolder = await drive.files.create({
        requestBody: sedeMetadata,
        fields: 'id',
        auth
      });
      sedeFolderId = newSedeFolder.data.id;
      console.log(`[Google Drive Service]: Created new folder for Sede ${sedeId}: ${sedeFolderId}`);
    }

    // 2. Create the child's dynamic subfolder
    const childFolderName = `${folio} - ${childName}`;
    const childMetadata = {
      name: childFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [sedeFolderId]
    };
    const childFolder = await drive.files.create({
      requestBody: childMetadata,
      fields: 'id',
      auth
    });
    const childFolderId = childFolder.data.id;
    console.log(`[Google Drive Service]: Created participant folder "${childFolderName}": ${childFolderId}`);

    // 3. Upload all files to the child's folder
    for (const fieldName in files) {
      const file = files[fieldName][0];
      if (file) {
        console.log(`[Google Drive Service]: Uploading ${fieldName} (${file.originalname})...`);
        const webViewLink = await uploadSingleFile(drive, file, childFolderId, auth);
        fileUrls[fieldName] = webViewLink;
      }
    }

    return fileUrls;
  } catch (error) {
    console.error('[Google Drive Service Error]: Failed to upload enrollment files:', error.message);
    throw error;
  }
};

/**
 * Extracts the file ID from a Google Drive URL.
 */
const getFileIdFromUrl = (url) => {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];
  return null;
};

/**
 * Extracts the folder ID from the participant's profileData by querying Drive for the parent of one of their files.
 * 
 * @param {Object} profileData - Participant's profile data
 * @returns {Promise<string|null>} Google Drive folder ID, or null/mock-id if not found/mock
 */
export const getFolderIdFromProfile = async (profileData) => {
  const clientData = getDriveClient();
  
  // If no drive client, return mock folder ID
  if (!clientData) {
    return 'mock-folder-id';
  }

  const { drive, auth } = clientData;

  // List of fields in profileData that might contain Google Drive file URLs
  const fileUrls = [
    profileData.fotoUrl,
    profileData.auth1FotoUrl,
    profileData.auth2FotoUrl,
    profileData.auth3FotoUrl
  ];

  for (const url of fileUrls) {
    if (!url) continue;
    const fileId = getFileIdFromUrl(url);
    if (fileId) {
      try {
        const res = await drive.files.get({
          fileId,
          fields: 'parents',
          auth
        });
        if (res.data.parents && res.data.parents.length > 0) {
          return res.data.parents[0];
        }
      } catch (err) {
        console.warn(`[Google Drive Service] Warning: Failed to fetch parent for fileId ${fileId}:`, err.message);
      }
    }
  }

  // Fallback: search by folder name
  try {
    const childFolderName = `${profileData.folio} - ${profileData.nombre} ${profileData.paterno} ${profileData.materno}`.trim();
    // 1. Find Sede folder
    let sedeFolderId;
    const sedeSearch = await drive.files.list({
      q: `name = '${profileData.sede}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      auth
    });
    if (sedeSearch.data.files && sedeSearch.data.files.length > 0) {
      sedeFolderId = sedeSearch.data.files[0].id;
    }
    
    const qStr = sedeFolderId 
      ? `name = '${childFolderName}' and '${sedeFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      : `name = '${childFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      
    const searchRes = await drive.files.list({
      q: qStr,
      fields: 'files(id)',
      spaces: 'drive',
      auth
    });
    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id;
    }
  } catch (err) {
    console.error(`[Google Drive Service] Error searching folder by name:`, err.message);
  }

  return null;
};

/**
 * Uploads the credential PDF buffer to the participant's Drive folder.
 * 
 * @param {string} folio - Folio ID
 * @param {string} sedeId - Sede ID
 * @param {string} childName - Child's full name
 * @param {Buffer} pdfBuffer - Generated PDF buffer
 * @param {string} folderId - Participant's Google Drive folder ID
 * @returns {Promise<string>} Web view link of the uploaded file
 */
export const uploadCredentialPdf = async (folio, sedeId, childName, pdfBuffer, folderId) => {
  if (!folderId) {
    throw new Error('Falta el folderId del participante');
  }

  const clientData = getDriveClient();
  const fileName = `Credencial_Verano_2026_${childName.replace(/\s+/g, '_')}.pdf`;

  if (!clientData) {
    const mockUrl = `https://drive.google.com/mock-file/${folio}/${fileName}`;
    console.log(`\n☁️  [Google Drive Mock Mode]: PDF upload simulation`);
    console.log(`📁 Target File: "${fileName}" -> URL: ${mockUrl}`);
    console.log(`☁️  [Google Drive Mock Mode]: Completed PDF upload simulation.\n`);
    return mockUrl;
  }

  const { drive, auth } = clientData;

  try {
    // Upload the PDF file buffer to the participant's specific folder
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };
    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      auth
    });

    // Make the file publicly readable
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        },
        auth
      });
    } catch (permError) {
      console.error(`[Google Drive Service] Warning: Failed to share PDF file:`, permError.message);
    }

    return response.data.webViewLink;
  } catch (error) {
    console.error('[Google Drive Service Error]: Failed to upload credential PDF:', error.message);
    throw error;
  }
};
