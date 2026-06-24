import fs from 'fs';
import { generateCredential } from './src/services/pdfService.js';

// Datos falsos para inyectar en la plantilla
const testProfile = {
    folio: 'UDU-26-99999',
    sede: 'UDU', // Cambia a 'CEFID' para probar la otra plantilla
    nombre: 'Niño',
    paterno: 'Prueba',
    materno: 'Felino',
    fotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80', // Foto dummy de internet
    auth1Nombre: 'Tutor Uno',
    auth1FotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80',
    auth2Nombre: 'Familiar Dos',
    auth2FotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80',
    auth3Nombre: 'Amigo Tres',
    auth3FotoUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=300&q=80'
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