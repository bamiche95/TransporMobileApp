const mysql = require('mysql2');
const emailService = require('./emailService');

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'transport_app',
  port: 3306,
  connectionLimit: 10
});

async function testEmail() {
    try {
        const jobId = 29; // Use an existing job ID
        const pdfPath = 'C:\\inetpub\\wwwroot\\Transport-app\\storage\\pdfs\\WTN_Test.pdf';
        const pdfName = 'WTN_Test.pdf';
        
        // Ensure PDF exists for test
        const fs = require('fs');
        if (!fs.existsSync(pdfPath)) {
            fs.writeFileSync(pdfPath, 'Test PDF content');
        }

        console.log('Starting email test...');
        const result = await emailService.sendWTNEmail(db, jobId, pdfPath, pdfName);
        console.log('Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        db.end();
    }
}

testEmail();
