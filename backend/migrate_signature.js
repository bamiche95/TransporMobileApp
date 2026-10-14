const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'transport_app',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to database');

    const queries = [
        'ALTER TABLE jobs ADD COLUMN customer_signature LONGTEXT NULL',
        'ALTER TABLE jobs ADD COLUMN customer_name VARCHAR(255) NULL',
        'ALTER TABLE jobs ADD COLUMN driver_comments TEXT NULL'
    ];

    let completed = 0;
    queries.forEach((query) => {
        db.query(query, (err) => {
            if (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log('Column already exists, skipping.');
                } else {
                    console.error('Error executing query:', query, err.message);
                }
            } else {
                console.log('Successfully executed:', query);
            }
            completed++;
            if (completed === queries.length) {
                db.end();
                console.log('Migration completed');
            }
        });
    });
});
