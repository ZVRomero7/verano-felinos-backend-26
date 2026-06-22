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

  // Values in order of columns in Google Sheets (Strict 37 columns mapping)
  const values = [
    [
      rowData.sedeId || '',                     // [0]: Sede
      rowData.folioId || '',                    // [1]: Folio
      rowData.timestamp || '',                  // [2]: Timestamp
      rowData.childName || '',                  // [3]: Nombre del Menor
      '',                                       // [4]: Paterno
      '',                                       // [5]: Materno
      '',                                       // [6]: Sexo
      rowData.childAge ?? '',                   // [7]: Edad
      '',                                       // [8]: Fecha Nac
      rowData.tutorName || '',                  // [9]: Nombre del Tutor
      rowData.tutorPhone || '',                 // [10]: Teléfono del Tutor
      '',                                       // [11]: Nombre Madre
      rowData.tutorEmail || '',                 // [12]: Correo Electrónico
      '',                                       // [13]: Contacto Emergencia
      '',                                       // [14]: Tel Emergencia
      rowData.allergies || 'Ninguna',           // [15]: Alergias
      rowData.bloodType || '',                  // [16]: Sangre
      rowData.medicalObservations || 'Ninguna', // [17]: Observaciones Médicas
      '',                                       // [18]: Médicos libre 1
      '',                                       // [19]: Médicos libre 2
      '',                                       // [20]: Médicos libre 3
      rowData.auth1Name || '',                  // [21]: Auth 1 Nombre
      rowData.auth1Phone || '',                 // [22]: Auth 1 Teléfono
      rowData.auth1PhotoUrl || '',              // [23]: Auth 1 URL Foto
      rowData.auth2Name || '',                  // [24]: Auth 2 Nombre
      rowData.auth2Phone || '',                 // [25]: Auth 2 Teléfono
      rowData.auth2PhotoUrl || '',              // [26]: Auth 2 URL Foto
      rowData.auth3Name || '',                  // [27]: Auth 3 Nombre
      rowData.auth3Phone || '',                 // [28]: Auth 3 Teléfono
      rowData.auth3PhotoUrl || '',              // [29]: Auth 3 URL Foto
      rowData.docCurpUrl || '',                 // [30]: URL del PDF/Img CURP
      rowData.docIneUrl || '',                  // [31]: URL del PDF/Img INE
      rowData.childPhotoUrl || '',              // [32]: URL de Foto del Rostro Menor
      '',                                       // [33]: Perfil Virtual
      '',                                       // [34]: Portal Edición
      rowData.status || 'Pendiente',            // [35]: Estatus
      ''                                        // [36]: Log
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
      range: 'A:AK', // Append to sheet starting from column A up to AK (37 columns)
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
      range: 'A:AK',
      auth
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    
    // Find row where column 1 matches the folioId
    const row = rows.find(r => r[1] === folioId);
    if (!row) {
      return null;
    }

    return {
      sedeId: row[0] || '',
      folioId: row[1] || '',
      timestamp: row[2] || '',
      childName: row[3] || '',
      childAge: row[7] || '',
      tutorName: row[9] || '',
      tutorPhone: row[10] || '',
      tutorEmail: row[12] || '',
      allergies: row[15] || '',
      bloodType: row[16] || '',
      medicalObservations: row[17] || '',
      auth1Name: row[21] || '',
      auth1Phone: row[22] || '',
      auth1PhotoUrl: row[23] || '',
      auth2Name: row[24] || '',
      auth2Phone: row[25] || '',
      auth2PhotoUrl: row[26] || '',
      auth3Name: row[27] || '',
      auth3Phone: row[28] || '',
      auth3PhotoUrl: row[29] || '',
      docCurpUrl: row[30] || '',
      docIneUrl: row[31] || '',
      childPhotoUrl: row[32] || '',
      status: row[35] || 'Pendiente'
    };
  } catch (error) {
    console.error('[Google Sheets Service Error]: Failed to fetch row by folio:', error.message);
    throw error;
  }
};
