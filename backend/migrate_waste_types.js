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

    db.query('SHOW COLUMNS FROM waste_types LIKE "pdf_field_name"', (err, results) => {
        if (err) {
            console.error('Error checking columns:', err);
            process.exit(1);
        }

        const runUpdates = () => {
            const updates = [
                ['metal_waste', 'General Metals'],
                ['cable_waste', 'Cable Waste'],
                ['wood_waste', 'Wood Waste'],
                ['mixed_weee', 'Mized WEEE waste'],
                ['aluminium_waste', 'Aliminium / NF Swarf'],
                ['oily_waste', 'Oily Absorbents'],
                ['plastic_waste', 'Plastics'],
                ['cardboard_waste', 'Cardboard waste'],
                ['paper_waste', 'Paper waste'],
                ['general_waste', 'General waste'],
                ['green_waste', 'Garden/Green']
            ];

            let completed = 0;
            updates.forEach(([field, name]) => {
                db.query('UPDATE waste_types SET pdf_field_name = ? WHERE waste_type_name = ?', [field, name], (err) => {
                    if (err) {
                        console.error(`Error updating ${name}:`, err);
                    } else {
                        console.log(`Updated ${name} to ${field}`);
                    }
                    completed++;
                    if (completed === updates.length) {
                        console.log('Migration complete');
                        db.end();
                    }
                });
            });
        };

        if (results.length === 0) {
            console.log('Adding column pdf_field_name...');
            db.query('ALTER TABLE waste_types ADD COLUMN pdf_field_name VARCHAR(255)', (err) => {
                if (err) {
                    console.error('Error adding column:', err);
                    process.exit(1);
                }
                console.log('Column added.');
                runUpdates();
            });
        } else {
            console.log('Column pdf_field_name already exists.');
            runUpdates();
        }
    });
});
