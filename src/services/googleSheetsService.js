import { google } from 'googleapis';

/**
 * Instantiates the Google Sheets client. Returns null if credentials are not configured.
 */
const getSheetsClient = () => {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!refreshToken) {
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    return { sheets, auth: oauth2Client };
  } catch (error) {
    console.error('[Google Sheets Auth Error]: Failed to create client:', error.message);
    return null;
  }
};

/**
 * Appends a new enrollment record row to the Google Sheet.
 * 
 * @param {Object} rowData - Form values and Drive file URLs
 */
export const appendEnrollmentRow = async (rowData) => {
  const clientData = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Values in order of columns in Google Sheets
  const values = [
    [
      rowData.folioId,
      rowData.timestamp,
      rowData.sedeId,
      rowData.childName,
      rowData.childAge,
      rowData.tutorName,
      rowData.tutorPhone,
      rowData.tutorEmail,
      rowData.bloodType,
      rowData.allergies || 'Ninguna',
      rowData.medicalObservations || 'Ninguna',
      rowData.docCurpUrl || '',
      rowData.docIneUrl || '',
      rowData.childPhotoUrl || '',
      rowData.auth1Name || '',
      rowData.auth1Phone || '',
      rowData.auth1PhotoUrl || '',
      rowData.auth2Name || '',
      rowData.auth2Phone || '',
      rowData.auth2PhotoUrl || '',
      rowData.auth3Name || '',
      rowData.auth3Phone || '',
      rowData.auth3PhotoUrl || '',
      rowData.status || 'Pendiente'
    ]
  ];

  // Run in Mock mode if Sheets client or Sheet ID is not set
  if (!clientData || !spreadsheetId) {
    console.log(`\n📊  [Google Sheets Mock Mode]: Row appending simulation`);
    console.log(`Spreadsheet ID: ${spreadsheetId || 'NOT_CONFIGURED'}`);
    console.log(`Row Data:`, values[0]);
    console.log(`📊  [Google Sheets Mock Mode]: Completed row append simulation.\n`);
    return { success: true, mockAppended: true };
  }

  const { sheets, auth } = clientData;

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A:Z', // Append to sheet starting from column A
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values
      },
      auth
    });

    console.log(`[Google Sheets Service]: Row appended successfully. Updated cells: ${response.data.updates.updatedCells}`);
    return { success: true, updatedCells: response.data.updates.updatedCells };
  } catch (error) {
    console.error('[Google Sheets Service Error]: Failed to append row:', error.message);
    throw error;
  }
};

/**
 * Fetches a participant row from Google Sheets by Folio ID.
 */
export const getRowByFolio = async (folioId) => {
  const clientData = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientData || !spreadsheetId) {
    console.log(`\n📊  [Google Sheets Mock Mode]: Fetching row simulation for folio: ${folioId}`);
    return {
      folioId,
      childName: 'Mock Participant',
      childAge: 10,
      sedeId: 'SEDE-NORTE',
      tutorName: 'Mock Tutor',
      tutorPhone: '1234567890',
      tutorEmail: 'tutor@mock.com',
      bloodType: 'O+',
      allergies: 'Ninguna',
      medicalObservations: 'Ninguna',
      status: 'Pendiente'
    };
  }

  const { sheets, auth } = clientData;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:Z',
      auth
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    
    // Find row where column 0 matches the folioId
    const row = rows.find(r => r[0] === folioId);
    if (!row) {
      return null;
    }

    return {
      folioId: row[0],
      timestamp: row[1],
      sedeId: row[2],
      childName: row[3],
      childAge: row[4],
      tutorName: row[5],
      tutorPhone: row[6],
      tutorEmail: row[7],
      bloodType: row[8],
      allergies: row[9],
      medicalObservations: row[10],
      docCurpUrl: row[11],
      docIneUrl: row[12],
      childPhotoUrl: row[13],
      auth1Name: row[14],
      auth1Phone: row[15],
      auth1PhotoUrl: row[16],
      auth2Name: row[17],
      auth2Phone: row[18],
      auth2PhotoUrl: row[19],
      auth3Name: row[20],
      auth3Phone: row[21],
      auth3PhotoUrl: row[22],
      status: row[23]
    };
  } catch (error) {
    console.error('[Google Sheets Service Error]: Failed to fetch row by folio:', error.message);
    throw error;
  }
};
