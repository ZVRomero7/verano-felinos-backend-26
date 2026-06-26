import fs from 'fs';
import { generateCredential } from './src/services/pdfService.js';

// Datos falsos para inyectar en la plantilla
const testProfile = {
    folio: 'UDU-26-99999',
    sede: 'UDU', // Cambia a 'CEFID' para probar la otra plantilla
    nombre: 'Adrián',
    paterno: 'Romero',
    materno: 'Felino',
    edad: '8',
    fotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80', // Foto dummy de internet
    emergencyContactName: 'Roberto Gómez',
    emergencyContactPhone: '442-123-4567',
    auth1Nombre: 'Victor Romero',
    auth1FotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80',
    auth1Telefono: '442-111-2233',
    auth2Nombre: 'Alexander Romero',
    auth2FotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80',
    auth2Telefono: '442-444-5566',
    auth3Nombre: 'Linda Ledesma',
    auth3FotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80',
    auth3Telefono: '442-777-8899'
};

const runTest = async () => {
    try {
        console.log('Generando PDF de prueba local...');
        const pdfBuffer = await generateCredential(testProfile);

        // Guardamos el PDF en tu carpeta del proyecto
        fs.writeFileSync('gafete_prueba.pdf', pdfBuffer);
        console.log('¡Éxito! PDF guardado como gafete_prueba.pdf en tu proyecto.');
    } catch (error) {
        console.error('Error generando PDF:', error);
    }
};

runTest();