import fs from 'fs';
import { JSDOM } from 'jsdom';

// Load HTML
const htmlPath = './src/views/enroll.html';
const html = fs.readFileSync(htmlPath, 'utf8');

// Create JSDOM instance
const dom = new JSDOM(html, { runScripts: "dangerously" });
const { window } = dom;
const { document } = window;

// Fill in the form elements
document.getElementById('sede_id').value = 'UDU';
document.getElementById('nombreInscrito').value = 'Juan Perez Lopez';
document.getElementById('child_birth_date').value = '2018-05-20';
document.getElementById('child_gender').value = 'Masculino';

// Age needs to be populated first
const ageSelect = document.getElementById('child_age');
ageSelect.disabled = false;
const opt = document.createElement('option');
opt.value = '8';
opt.selected = true;
ageSelect.appendChild(opt);

document.getElementById('tutor_name').value = 'Juan Perez Padre';
document.getElementById('tutor_phone').value = '1234567890';
document.getElementById('tutor_email').value = 'padre@gmail.com';
document.getElementById('emergency_contact_name').value = 'Maria Lopez';
document.getElementById('emergency_contact_phone').value = '0987654321';
document.getElementById('blood_type').value = 'O+';
document.getElementById('allergiesInput').value = 'Ninguna';
document.getElementById('medical_observations').value = 'Ninguna';

// Auth name/phones
const authNames = document.getElementsByName('auth1Nombre');
authNames[0].value = 'Autorizado Uno';
const authPhones = document.getElementsByName('auth1Telefono');
authPhones[0].value = '1111111111';

// Let's mock files
const form = document.getElementById('enrollmentForm');

// Run the submit logic
const formData = new window.FormData(form);

// Run the duplication logic
formData.append('sede_id', formData.get('sede') || '');
formData.append('child_gender', formData.get('sexo') || '');
formData.append('child_age', formData.get('edad') || '');
formData.append('child_birth_date', formData.get('fechaNacimiento') || '');
formData.append('tutor_name', formData.get('nombreTutor') || '');
formData.append('tutor_phone', formData.get('telefonoContacto') || '');
formData.append('tutor_email', formData.get('correoElectronico') || '');
formData.append('emergency_contact_name', formData.get('contactoEmergencia') || '');
formData.append('emergency_contact_phone', formData.get('telefonoEmergencia') || '');
formData.append('allergies', formData.get('alergiasMedicas') || 'Ninguna');
formData.append('medical_observations', formData.get('padecimientos') || 'Ninguna');
formData.append('blood_type', formData.get('tipoSangre') || '');

formData.append('auth1_name', formData.get('auth1Nombre') || '');
formData.append('auth1_phone', formData.get('auth1Telefono') || '');

console.log('--- FormData Entries ---');
for (const [key, val] of formData.entries()) {
  console.log(`${key}: ${val}`);
}
