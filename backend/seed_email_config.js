const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'transport_app',
    port: 3306
});

const config = {
    config_name: 'RML email config',
    smtp_host: 'mail.recman.com',
    smtp_port: 587,
    smtp_auth: 1,
    smtp_auth_type: 'LOGIN',
    smtp_username: 'rcm\\sales',
    smtp_password: 'bkL$4197!',
    smtp_secure: 'tls',
    smtp_auto_tls: 1,
    from_email: 'sales@recman.com',
    from_name: 'RML Transport Report',
    is_active: 1,
    is_default: 1,
    created_by: 1,
    modified_by: 1
};

const query = `
  INSERT INTO email_config (
    config_name, smtp_host, smtp_port, smtp_auth, smtp_auth_type, 
    smtp_username, smtp_password, smtp_secure, smtp_auto_tls, 
    from_email, from_name, is_active, is_default, 
    created_by, modified_by, created_at, modified_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  ON DUPLICATE KEY UPDATE 
    smtp_host = VALUES(smtp_host),
    smtp_port = VALUES(smtp_port),
    smtp_username = VALUES(smtp_username),
    smtp_password = VALUES(smtp_password),
    smtp_secure = VALUES(smtp_secure),
    from_email = VALUES(from_email),
    from_name = VALUES(from_name),
    modified_at = NOW();
`;

const values = [
    config.config_name, config.smtp_host, config.smtp_port, config.smtp_auth, config.smtp_auth_type,
    config.smtp_username, config.smtp_password, config.smtp_secure, config.smtp_auto_tls,
    config.from_email, config.from_name, config.is_active, config.is_default,
    config.created_by, config.modified_by
];

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }

    db.query(query, values, (err, results) => {
        if (err) {
            console.error('Error inserting config:', err);
        } else {
            console.log('SMTP configuration updated successfully');
        }
        db.end();
    });
});
