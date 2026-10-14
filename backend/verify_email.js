const emailService = require('./emailService');

// Mock database
const db = {
    query: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        console.log(`Executing SQL: ${sql}`);

        if (sql.includes('email_config')) {
            // Return mock SMTP config
            callback(null, [{
                smtp_host: 'smtp.example.com',
                smtp_port: 587,
                smtp_auth: 1,
                smtp_username: 'user@example.com',
                smtp_password: 'password',
                smtp_secure: 'tls',
                smtp_auto_tls: 1,
                from_email: 'noreply@example.com',
                from_name: 'Transport App',
                is_active: 1,
                is_default: 1
            }]);
        } else if (sql.includes('wtn_email_recipients')) {
            // Return mock recipients
            callback(null, [
                { email: 'recipient1@example.com', name: 'Recipient One' },
                { email: 'recipient2@example.com', name: 'Recipient Two' }
            ]);
        } else {
            callback(new Error('Unknown query'));
        }
    }
};

async function test() {
    console.log('Starting email service test...');
    try {
        // We expect this to fail during actual sending because smtp.example.com doesn't exist,
        // but it will verify the DB fetching logic and the transport creation.
        const result = await emailService.sendWTNEmail(db, 123, './pdfs/test.pdf', 'WTN_123.pdf');
        console.log('Test result:', result);
    } catch (error) {
        if (error.code === 'ENOTFOUND' || error.message.includes('getaddrinfo')) {
            console.log('Success: Reached email sending stage (failed as expected due to mock host)');
        } else {
            console.error('Test failed with unexpected error:', error);
        }
    }
}

test();
