const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function getSMTPConfig(db) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM email_config WHERE is_active = 1 ORDER BY is_default DESC LIMIT 1';
        db.query(query, (err, results) => {
            if (err) return reject(err);
            if (results.length === 0) return reject(new Error('No active SMTP configuration found'));
            resolve(results[0]);
        });
    });
}

async function getRecipients(db, companyId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT email, name FROM wtn_email_recipients WHERE company_id = ?';
        db.query(query, [companyId], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

async function sendWTNEmail(db, jobId, pdfPath, pdfName) {
    try {
        // Fetch company_id from jobs table
        const jobInfo = await new Promise((resolve, reject) => {
            db.query(`
                SELECT j.company_id, j.customer_email, j.ticket_number, j.job_date, c.customer_name as site_name, comp.company_name
                FROM jobs j
                LEFT JOIN customer c ON j.customer_id = c.customer_id
                LEFT JOIN company comp ON j.company_id = comp.company_id
                WHERE j.job_id = ?
            `, [jobId], (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return reject(new Error(`Job #${jobId} not found`));
                resolve(results[0]);
            });
        });

        const companyId = jobInfo.company_id;
        const customerEmail = jobInfo.customer_email;
        const paddedJobId = String(jobInfo.job_id).padStart(6, '0');
        const ticketNumber = paddedJobId;
        const siteName = jobInfo.site_name || 'N/A';
        const jobDate = jobInfo.job_date ? new Date(jobInfo.job_date).toLocaleDateString() : 'N/A';

        const smtpConfig = await getSMTPConfig(db);
        const recipients = await getRecipients(db, companyId);

        let recipientEmails = recipients.map(r => r.email).join(', ');
        if (customerEmail) {
            recipientEmails = recipientEmails ? `${recipientEmails}, ${customerEmail}` : customerEmail;
        }

        if (!recipientEmails) {
            console.log(`No email recipients found for Company ID #${companyId} or Job #${jobId}. Skipping email.`);
            return { success: false, message: 'No recipients found' };
        }

        console.log(`[Email] Sending WTN for Job #${jobId} to: ${recipientEmails}`);

        const transporter = nodemailer.createTransport({
            host: smtpConfig.smtp_host,
            port: smtpConfig.smtp_port,
            secure: smtpConfig.smtp_secure === 'ssl',
            auth: {
                user: smtpConfig.smtp_username,
                pass: smtpConfig.smtp_password,
            },
            tls: {
                rejectUnauthorized: smtpConfig.smtp_auto_tls === 1 ? false : true,
                minVersion: 'TLSv1.2'
            }
        });

        const logoPath = path.join(__dirname, '..', 'assets', 'icon.png');

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { width: 100%; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; }
                .header { background-color: #0fb91dff; padding: 30px; text-align: center; color: white; }
                .header img { max-width: 120px; margin-bottom: 10px; }
                .content { padding: 40px; background-color: #ffffff; }
                .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0; }
                .details-box { background-color: #f0f4f8; padding: 20px; border-radius: 8px; margin: 25px 0; }
                .details-row { display: flex; margin-bottom: 10px; border-bottom: 1px solid #d1d9e6; padding-bottom: 5px; }
                .details-label { font-weight: bold; width: 140px; color: #003366; }
                .btn { display: inline-block; padding: 12px 25px; background-color: #003366; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
                h2 { color: #003366; margin-top: 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="cid:rml_logo" alt="RML Transport Logo">
                    <h1 style="margin: 0; font-size: 24px;">RML Transport</h1>
                </div>
                <div class="content">
                    <h2>Waste Transfer Note</h2>
                    <p>Dear Customer,</p>
                    <p>Please find attached the Waste Transfer Note (WTN) for the transport services completed today.</p>
                    
                    <div class="details-box">
                        <div class="details-row">
                            <span class="details-label">Ticket Number:</span>
                            <span>${ticketNumber}</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">Job Date:</span>
                            <span>${jobDate}</span>
                        </div>
                        <div class="details-row">
                            <span class="details-label">Site Name:</span>
                            <span>${siteName}</span>
                        </div>
                    </div>
                    
                    <p>If you have any questions regarding this document or our services, please do not hesitate to contact our office.</p>
                    <p>Thank you for choosing RML Transport Ltd.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br><strong>RML Transport Ltd.</strong></p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} RML Transport Ltd. All rights reserved.</p>
                    <p>This is an automated message, please do not reply directly to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"RML Transport" <${smtpConfig.from_email}>`,
            to: recipientEmails,
            subject: `Waste Transfer Note: ${ticketNumber} - ${siteName}`,
            text: `Please find attached the Waste Transfer Note for Ticket #${ticketNumber} at ${siteName} on ${jobDate}.`,
            html: htmlContent,
            attachments: [
                {
                    filename: pdfName,
                    path: pdfPath
                },
                {
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'rml_logo'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

module.exports = {
    sendWTNEmail
};
