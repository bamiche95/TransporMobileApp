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

    db.query('SELECT user_id, username, first_name, last_name, password_hash FROM users', (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
        } else {
            console.log('Users in database:');
            console.log(JSON.stringify(results, null, 2));
        }
        db.end();
    });
});
