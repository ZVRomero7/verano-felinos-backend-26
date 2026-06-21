import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Google Workspace Drive Root ID from config.json
const configPath = path.join(__dirname, '../../config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('[Google Drive Service]: Failed to load config.json:', error.message);
}

const rootFolderId = config?.google_workspace?.drive_root_id || '1NaiQdN_Pxqg0ALWtTK_hED5uke6QG18o';

/**
 * Instantiates the Google Drive client. Returns null if credentials are not configured.
 */
const getDriveClient = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !privateKey) {
    return null;
  }

  try {
    const formattedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: email,
      key: formattedKey,
      private_key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });
    return { drive, auth };
  } catch (error) {
    console.error('[Google Drive Auth Error]: Failed to create client:', error.message);
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
