import fs from 'fs';
import { JSDOM } from 'jsdom';

const htmlPath = './src/views/enroll.html';
const html = fs.readFileSync(htmlPath, 'utf8');

const dom = new JSDOM(html);
const { document } = dom.window;

const form = document.getElementById('enrollmentForm');
if (!form) {
  console.error('Form not found!');
  process.exit(1);
}

console.log('Form is found.');

// List all inputs/selects/textareas in the document
const allInputs = Array.from(document.querySelectorAll('input, select, textarea'));
console.log(`Total inputs in document: ${allInputs.length}`);

// List all inputs/selects/textareas inside the form
const formInputs = Array.from(form.querySelectorAll('input, select, textarea'));
console.log(`Total inputs inside form: ${formInputs.length}`);

// Find which inputs are NOT inside the form
const outsideInputs = allInputs.filter(input => !form.contains(input));
if (outsideInputs.length > 0) {
  console.log('\n--- INPUTS OUTSIDE THE FORM ---');
  outsideInputs.forEach(input => {
    console.log(`${input.tagName}: name="${input.getAttribute('name')}" id="${input.getAttribute('id')}"`);
  });
} else {
  console.log('\nAll inputs are successfully inside the form!');
}
