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
 * @param {Array} rowDataArray - Form values and Drive file URLs
 */
export const appendEnrollmentRow = async (rowDataArray) => {
  const clientData = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Run in Mock mode if Sheets client or Sheet ID is not set
  if (!clientData || !spreadsheetId) {
    console.log(`\n📊  [Google Sheets Mock Mode]: Row appending simulation`);
    console.log(`Spreadsheet ID: ${spreadsheetId || 'NOT_CONFIGURED'}`);
    console.log(`Row Data:`, rowDataArray);
    console.log(`📊  [Google Sheets Mock Mode]: Completed row append simulation.\n`);
    return { success: true, mockAppended: true };
  }

  const { sheets, auth } = clientData;

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'BD_Inscripciones!A:AH', // Append to sheet starting from column A up to AH (34 columns)
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowDataArray] // ENVÍA EL ARRAY DIRECTO
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
      range: 'A:AH',
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
      emergencyContactName: row[12] || '',
      emergencyContactPhone: row[13] || '',
      allergies: row[14] || '',
      medicalObservations: row[15] || '',
      bloodType: row[16] || '',
      auth1Name: row[17] || '',
      auth1Phone: row[18] || '',
      auth1PhotoUrl: row[19] || '',
      auth2Name: row[20] || '',
      auth2Phone: row[21] || '',
      auth2PhotoUrl: row[22] || '',
      auth3Name: row[23] || '',
      auth3Phone: row[24] || '',
      auth3PhotoUrl: row[25] || '',
      childPhotoUrl: row[26] || '',
      docCurpUrl: row[27] || '',
      docIneUrl: row[28] || '',
      status: row[31] || 'Pendiente'
    };
  } catch (error) {
    console.error('[Google Sheets Service Error]: Failed to fetch row by folio:', error.message);
    throw error;
  }
};

/**
 * Reads an enrollment record by Folio ID from the BD_Inscripciones sheet.
 * 
 * @param {string} folioId - The folio ID to search
 * @returns {Object|null} Mapped enrollment data or null if not found
 */
export const getEnrollmentByFolio = async (folioId) => {
  const clientData = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientData || !spreadsheetId) {
    console.log(`\n📊  [Google Sheets Mock Mode]: Fetching row simulation for folio: ${folioId}`);
    if (folioId === 'NON-EXISTENT' || folioId === 'not-found') {
      return null;
    }
    return {
      sede: 'UDU',
      folio: folioId,
      nombre: 'Juan',
      paterno: 'Perez',
      materno: 'Lopez',
      sexo: 'Masculino',
      edad: '8',
      fechaNacimiento: '2018-05-20',
      tutor: 'Juan Perez Padre',
      telefonoTutor: '1234567890',
      correo: 'padre@gmail.com',
      contactoEmergencia: 'Maria Lopez',
      telefonoEmergencia: '0987654321',
      alergias: 'Ninguna',
      padecimientos: 'Ninguna',
      sangre: 'O+',
      auth1Nombre: 'Autorizado Uno',
      auth1Telefono: '1111111111',
      auth1FotoUrl: 'https://drive.google.com/mock-file/' + folioId + '/auth1_photo_auth1.jpg',
      auth2Nombre: 'Autorizado Dos',
      auth2Telefono: '2222222222',
      auth2FotoUrl: 'https://drive.google.com/mock-file/' + folioId + '/auth2_photo_auth2.jpg',
      auth3Nombre: 'Autorizado Tres',
      auth3Telefono: '3333333333',
      auth3FotoUrl: 'https://drive.google.com/mock-file/' + folioId + '/auth3_photo_auth3.jpg',
      fotoUrl: 'https://drive.google.com/mock-file/' + folioId + '/child_photo_child.jpg',
      estatus: 'Pendiente'
    };
  }

  const { sheets, auth } = clientData;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'BD_Inscripciones!A:AH',
      auth
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // Find row where index [1] (Folio) matches folioId exactly
    const row = rows.find(r => r[1] === folioId);
    if (!row) {
      return null;
    }

    return {
      sede: row[0] || '',
      folio: row[1] || '',
      nombre: row[3] || '',
      paterno: row[4] || '',
      materno: row[5] || '',
      sexo: row[6] || '',
      edad: row[7] || '',
      fechaNacimiento: row[8] || '',
      tutor: row[9] || '',
      telefonoTutor: row[10] || '',
      correo: row[11] || '',
      contactoEmergencia: row[12] || '',
      telefonoEmergencia: row[13] || '',
      alergias: row[14] || '',
      padecimientos: row[15] || '',
      sangre: row[16] || '',
      auth1Nombre: row[17] || '',
      auth1Telefono: row[18] || '',
      auth1FotoUrl: row[19] || '',
      auth2Nombre: row[20] || '',
      auth2Telefono: row[21] || '',
      auth2FotoUrl: row[22] || '',
      auth3Nombre: row[23] || '',
      auth3Telefono: row[24] || '',
      auth3FotoUrl: row[25] || '',
      fotoUrl: row[26] || '',
      estatus: row[31] || 'Pendiente'
    };
  } catch (error) {
    console.error('[Google Sheets Service Error]: Failed to fetch enrollment by folio:', error.message);
    throw error;
  }
};
