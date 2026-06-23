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

  // Values in order of columns in Google Sheets (Strict 38 columns mapping)
  const values = [
    [
      rowData.sedeId || '',                     // [0] Sede
      rowData.folioId || '',                    // [1] Folio
      rowData.timestamp || '',                  // [2] Fecha (ISO String)
      rowData.childName || '',                  // [3] Nombre Completo del Menor
      rowData.childLastName || '',              // [4] Paterno
      rowData.childSecondLastName || '',        // [5] Materno
      rowData.childGender || '',                // [6] Sexo
      rowData.childAge ?? '',                   // [7] Edad
      rowData.childBirthDate || '',             // [8] Fecha Nacimiento
      rowData.tutorName || '',                  // [9] Nombre del Tutor
      rowData.tutorPhone || '',                 // [10] Teléfono del Tutor
      rowData.tutorEmail || '',                 // [11] Correo Electrónico del Tutor (Columna L)
      '',                                       // [12] Madre Tel
      rowData.emergencyContactName || '',       // [13] Contacto Emergencia
      rowData.emergencyContactPhone || '',      // [14] Tel Emergencia
      rowData.allergies || 'Ninguna',           // [15] Alergias Generales
      '',                                       // [16] Med
      '',                                       // [17] Lesiones
      '',                                       // [18] Tratamientos
      rowData.medicalObservations || 'Ninguna', // [19] Padecimientos Crónicos/Observaciones
      rowData.bloodType || '',                  // [20] Tipo de Sangre
      rowData.auth1Name || '',                  // [21] Auth 1: Nombre
      rowData.auth1Phone || '',                 // [22] Auth 1: Tel
      rowData.auth1PhotoUrl || '',              // [23] Auth 1: FotoURL
      rowData.auth2Name || '',                  // [24] Auth 2: Nombre
      rowData.auth2Phone || '',                 // [25] Auth 2: Tel
      rowData.auth2PhotoUrl || '',              // [26] Auth 2: FotoURL
      rowData.auth3Name || '',                  // [27] Auth 3: Nombre
      rowData.auth3Phone || '',                 // [28] Auth 3: Tel
      rowData.auth3PhotoUrl || '',              // [29] Auth 3: FotoURL
      rowData.childPhotoUrl || '',              // [30] Foto Menor URL (Columna AE)
      rowData.docCurpUrl || '',                 // [31] CURP URL (Columna AF)
      rowData.docIneUrl || '',                  // [32] INE URL (Columna AG)
      '',                                       // [33] Perfil Virtual
      '',                                       // [34] Portal Edición
      rowData.status || 'Pendiente',            // [35] 'Pendiente' (Estatus)
      '',                                       // [36] Log
      ''                                        // [37] Enlace PDF
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
      range: 'A:AL', // Append to sheet starting from column A up to AL (38 columns)
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
      sedeId: 'UDU',
      folioId,
      timestamp: new Date().toISOString(),
      childName: 'Mock Participant',
      childLastName: 'Pérez',
      childSecondLastName: 'Gómez',
      childGender: 'Masculino',
      childAge: 10,
      childBirthDate: '2016-06-22',
      tutorName: 'Mock Tutor',
      tutorPhone: '1234567890',
      tutorEmail: 'tutor@mock.com',
      emergencyContactName: 'Emergency Contact',
      emergencyContactPhone: '9876543210',
      allergies: 'Ninguna',
      medicalObservations: 'Ninguna',
      bloodType: 'O+',
      auth1Name: 'Auth 1',
      auth1Phone: '1234567891',
      auth1PhotoUrl: '',
      auth2Name: 'Auth 2',
      auth2Phone: '1234567892',
      auth2PhotoUrl: '',
      auth3Name: 'Auth 3',
      auth3Phone: '1234567893',
      auth3PhotoUrl: '',
      childPhotoUrl: '',
      docCurpUrl: '',
      docIneUrl: '',
      status: 'Pendiente'
    };
  }

  const { sheets, auth } = clientData;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:AL',
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
      childLastName: row[4] || '',
      childSecondLastName: row[5] || '',
      childGender: row[6] || '',
      childAge: row[7] || '',
      childBirthDate: row[8] || '',
      tutorName: row[9] || '',
      tutorPhone: row[10] || '',
      tutorEmail: row[11] || '',
      emergencyContactName: row[13] || '',
      emergencyContactPhone: row[14] || '',
      allergies: row[15] || '',
      medicalObservations: row[19] || '',
      bloodType: row[20] || '',
      auth1Name: row[21] || '',
      auth1Phone: row[22] || '',
      auth1PhotoUrl: row[23] || '',
      auth2Name: row[24] || '',
      auth2Phone: row[25] || '',
      auth2PhotoUrl: row[26] || '',
      auth3Name: row[27] || '',
      auth3Phone: row[28] || '',
      auth3PhotoUrl: row[29] || '',
      childPhotoUrl: row[30] || '',
      docCurpUrl: row[31] || '',
      docIneUrl: row[32] || '',
      status: row[35] || 'Pendiente'
    };
  } catch (error) {
    console.error('[Google Sheets Service Error]: Failed to fetch row by folio:', error.message);
    throw error;
  }
};
