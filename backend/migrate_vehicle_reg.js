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

    const query = 'ALTER TABLE jobs ADD COLUMN vehicle_reg VARCHAR(50) NULL';

    db.query(query, (err) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column vehicle_reg already exists, skipping.');
            } else {
                console.error('Error executing query:', err.message);
            }
        } else {
            console.log('Successfully executed:', query);
        }
        db.end();
    });
});
