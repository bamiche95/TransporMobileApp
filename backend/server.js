const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const emailService = require('./emailService');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Set up public folder for PDFs
const pdfsDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir);
}
app.use('/public/pdfs', express.static(pdfsDir));

// JWT Secret - in production, this should be in environment variables
const JWT_SECRET = '3f5fa854913ff36f172bdea8e0eec27a4b94775a7408c8b6186489d563c3be79';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'transport_app',
  port: 3307,
  connectionLimit: 10
});

// Helper to execute queries using a pooled connection
function queryWithConnection(sql, params) {
  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) return reject(err);
      connection.query(sql, params, (qerr, results) => {
        connection.release();
        if (qerr) return reject(qerr);
        resolve(results);
      });
    });
  });
}


// Test connection on startup
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to database');
    connection.release();
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const results = await queryWithConnection('SELECT * FROM users WHERE username = ?', [username]);
  if (results.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = results[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.user_id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  const { password_hash, ...userData } = user;
  res.json({ user: userData, token });
});

app.get('/customers/search', authenticateToken, async (req, res) => {
  console.log('Search route hit with query:', req.query.query);
  const query = req.query.query;
  try {
    const searchQuery = `%${query}%`;
    const results = await queryWithConnection('SELECT customer_id, customer_name FROM customer WHERE customer_name LIKE ? LIMIT 10', [searchQuery]);
    res.json({ customers: results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/jobs', authenticateToken, async (req, res) => {
  const userId = req.user.userId; // Get user ID from JWT token
  try {
    const results = await queryWithConnection(`
      SELECT jobs.*, job_status.job_status_name, bintype.bin_name, jobs.job_type_id AS job_type, c.company_name, jt.job_type_name, jt.allows_collect, jt.allows_deliver, cust.customer_name
      FROM jobs
      JOIN job_status ON jobs.job_status_id = job_status.job_status_id
      JOIN bintype ON jobs.bin_type_id = bintype.bin_type_id
      JOIN company c ON jobs.company_id = c.company_id
      JOIN customer cust ON jobs.customer_id = cust.customer_id
      JOIN jobtype jt ON jobs.job_type_id = jt.job_type_id
      WHERE jobs.assigned_to = ? AND DATE(jobs.job_date) = CURDATE() AND job_status.job_status_name IN ('Open', 'In Progress')
      ORDER BY CAST(jobs.priority AS UNSIGNED) ASC
    `, [userId]);
    res.json({ jobs: results });
  } catch (err) {
    console.error('Jobs fetch error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
app.get('/job/:job_id', authenticateToken, async (req, res) => {
  const jobId = req.params.job_id;
  try {
    const query = `
      SELECT jobs.*, job_status.job_status_name, bintype.bin_name, c.company_name, jt.job_type_name, jt.allows_collect, jt.allows_deliver, cust.customer_name,
      EXISTS(SELECT 1 FROM job_bins WHERE job_id = jobs.job_id) AS has_bins
      FROM jobs
      JOIN job_status ON jobs.job_status_id = job_status.job_status_id
      JOIN bintype ON jobs.bin_type_id = bintype.bin_type_id
      JOIN company c ON jobs.company_id = c.company_id
      JOIN customer cust ON jobs.customer_id = cust.customer_id
      JOIN jobtype jt ON jobs.job_type_id = jt.job_type_id
      WHERE jobs.job_id = ?
    `;
    const results = await queryWithConnection(query, [jobId]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ job: results[0] });
  } catch (err) {
    console.error('Job fetch error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/job/:job_id/status', authenticateToken, async (req, res) => {
  console.log(`Received status update request for job ${req.params.job_id}`);
  const jobId = req.params.job_id;
  const { job_status_id } = req.body;
  const userId = req.user.userId;

  if (!job_status_id) {
    return res.status(400).json({ error: 'Job status ID required' });
  }

  try {
    const result = await queryWithConnection('UPDATE jobs SET job_status_id = ?, modified_by = ?, modified_at = NOW() WHERE job_id = ?', [job_status_id, userId, jobId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/lug-locks/:job_id', authenticateToken, (req, res) => {
  const jobId = req.params.job_id;

  // First get the bin name for this job
  const jobQuery = `
    SELECT bintype.bin_name 
    FROM jobs 
    JOIN bintype ON jobs.bin_type_id = bintype.bin_type_id 
    WHERE jobs.job_id = ?
  `;

  db.query(jobQuery, [jobId], (err, jobResults) => {
    if (err) {
      console.error('Database error fetching job bin type:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (jobResults.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const binName = jobResults[0].bin_name.toLowerCase();
    console.log(`Lug Lock request for Job ${jobId}, Bin Type: ${binName}`);
    let typeFilter = '';
    if (binName.includes('roro')) {
      typeFilter = 'roro';
    } else if (binName.includes('skip')) {
      typeFilter = 'skip';
    }

    console.log(`Type Filter detected: ${typeFilter}`);

    if (!typeFilter) {
      console.log('No type filter detected, returning empty list');
      return res.json({ lug_locks: [] });
    }

    const lugQuery = `
      SELECT ll.*, lt.name as type_name 
      FROM lug_locks ll
      JOIN lug_type lt ON ll.lug_type_id = lt.id
      WHERE lt.name LIKE ? AND (ll.job_id IS NULL OR ll.job_id = ?)
    `;

    db.query(lugQuery, [`%${typeFilter}%`, jobId], (err, lugResults) => {
      if (err) {
        console.error('Database error fetching lug locks:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log(`Found ${lugResults.length} lug locks for filter %${typeFilter}%`);
      res.json({ lug_locks: lugResults });
    });
  });
});

app.get('/bins/check', authenticateToken, async (req, res) => {
  const binNumber = req.query.bin_number;
  if (!binNumber) {
    return res.status(400).json({ error: 'Bin number required' });
  }
  try {
    const results = await queryWithConnection('SELECT bin_id FROM bins WHERE bin_number = ?', [binNumber]);
    res.json({ exists: results.length > 0 });
  } catch (err) {
    console.error('Bin check error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/bins/:customer_id', authenticateToken, async (req, res) => {
  const customerId = req.params.customer_id;
  try {
    const results = await queryWithConnection(`
      SELECT bins.bin_description, bins.bin_number, bintype.bin_name
      FROM bins
      JOIN bintype ON bins.bin_type_id = bintype.bin_type_id
      WHERE bins.customer_id = ?
    `, [customerId]);
    res.json({ bins: results });
  } catch (err) {
    console.error('Bins fetch error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/users/me/signature', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { signature } = req.body;

  if (!signature) {
    return res.status(400).json({ error: 'Signature is required' });
  }

  try {
    await queryWithConnection('UPDATE users SET signature = ? WHERE user_id = ?', [signature, userId]);
    res.json({ success: true, message: 'Signature updated successfully' });
  } catch (err) {
    console.error('Error updating user signature:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


app.post('/bins/update-location', authenticateToken, (req, res) => {
  const { customer_id, bin_numbers } = req.body;
  const userId = req.user.userId;

  if (!customer_id || !bin_numbers || !Array.isArray(bin_numbers) || bin_numbers.length === 0) {
    return res.status(400).json({ error: 'Customer ID and bin numbers required' });
  }

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection error' });
    connection.beginTransaction((err) => {
      if (err) { connection.release(); return res.status(500).json({ error: 'Transaction error' }); }

      let processed = 0;
      let hasError = false;

      const finalize = () => {
        processed++;
        if (processed === bin_numbers.length && !hasError) {
          connection.commit((err) => {
            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: 'Commit error' }); });
            res.json({ success: true });
            connection.release();
          });
        }
      };

      bin_numbers.forEach((binNumber) => {
        if (hasError) return;
        const trimmedBin = binNumber.trim();
        if (!trimmedBin) { finalize(); return; }

        connection.query('SELECT bin_id, customer_id FROM bins WHERE bin_number = ?', [trimmedBin], (err, binResults) => {
          if (hasError) return;
          if (err || binResults.length === 0) {
            hasError = true;
            return connection.rollback(() => { connection.release(); res.status(err ? 500 : 404).json({ error: err ? 'Database error' : `Bin ${trimmedBin} not found` }); });
          }

          const bin = binResults[0];
          const getCustomerName = (id, cb) => {
            if (!id) return cb(null, 'Unknown');
            connection.query('SELECT customer_name FROM customer WHERE customer_id = ?', [id], (err, res) => cb(err, res[0]?.customer_name || 'Unknown'));
          };

          getCustomerName(bin.customer_id, (err, fromLoc) => {
            if (hasError) return;
            getCustomerName(customer_id, (err, toLoc) => {
              if (hasError) return;
              connection.query('UPDATE bins SET customer_id = ?, modified_by = ?, modified_at = NOW() WHERE bin_id = ?', [customer_id, userId, bin.bin_id], (err) => {
                if (err) { hasError = true; return connection.rollback(() => { connection.release(); res.status(500).json({ error: 'DB Error' }); }); }
                connection.query('INSERT INTO binhistory (bin_id, job_id, from_location, to_location, moved_by, moved_at) VALUES (?, NULL, ?, ?, ?, NOW())', [bin.bin_id, fromLoc, toLoc, userId], (err) => {
                  if (err) { hasError = true; return connection.rollback(() => { connection.release(); res.status(500).json({ error: 'DB Error' }); }); }
                  finalize();
                });
              });
            });
          });
        });
      });
    });
  });
});


app.post('/execute/:job_id', authenticateToken, (req, res) => {
  const jobId = req.params.job_id;
  const { collect_numbers = [], deliver_numbers = [], lug_locks = [] } = req.body;
  const userId = req.user.userId;

  let responseSent = false;
  const sendResponse = (status, data) => {
    if (responseSent) return;
    responseSent = true;
    res.status(status).json(data);
  };

  const sendError = (message, status = 400) => {
    if (responseSent) return;
    responseSent = true;
    res.status(status).json({ error: message });
  };

  db.getConnection((err, conn) => {
    if (err) return sendError('Database connection error', 500);

    conn.beginTransaction((err) => {
      if (err) { conn.release(); return sendError('Transaction error', 500); }

      // ✅ Fix 1: Duplicate execution guard is INSIDE beginTransaction but BEFORE any other query
      conn.query(
        'SELECT COUNT(*) as count FROM job_bins WHERE job_id = ?',
        [jobId],
        (err, results) => {
          if (err) return conn.rollback(() => { conn.release(); sendError('Database error', 500); });

          if (results[0].count > 0) {
            return conn.rollback(() => { conn.release(); sendError('Job has already been executed', 409); });
          }

          // ✅ Fix 2: Job fetch is INSIDE the duplicate check callback, not floating outside
          conn.query(
            'SELECT j.*, bt.bin_name FROM jobs j JOIN bintype bt ON j.bin_type_id = bt.bin_type_id WHERE j.job_id = ?',
            [jobId],
            (err, jobResults) => {
              if (err) return conn.rollback(() => { conn.release(); sendError('Database error', 500); });
              if (jobResults.length === 0) return conn.rollback(() => { conn.release(); sendError('Job not found', 404); });

              const job = jobResults[0];

              conn.query(
                'SELECT job_type_name, allows_collect, allows_deliver FROM jobtype WHERE job_type_id = ?',
                [job.job_type_id],
                (err, jobTypeResults) => {
                  if (err) return conn.rollback(() => { conn.release(); sendError('Database error', 500); });
                  if (jobTypeResults.length === 0) return conn.rollback(() => { conn.release(); sendError('Invalid job type', 400); });

                  const jobType = jobTypeResults[0];

                  const allowsCollect = jobType.allows_collect === 1;
                  const allowsDeliver = jobType.allows_deliver === 1;
                  const skipTypeCheck = jobType.job_type_name === 'Exchange' &&
                    ['RoRo Transport Job', 'Skip Transport Job'].includes(job.bin_name);
                  const causesCustomerChange = ['Collect', 'Deliver', 'Exchange'].includes(jobType.job_type_name);
                  const singleBinOnly = ['Tip And Return', 'Relocate', 'Transport', 'Wait and Load'].includes(jobType.job_type_name);

                  const getCustomerName = (customerId, callback) => {
                    if (!customerId) return callback(null, 'Unknown');
                    conn.query('SELECT customer_name FROM customer WHERE customer_id = ?', [customerId], (err, results) => {
                      if (err) return callback(err);
                      callback(null, results[0]?.customer_name || 'Unknown');
                    });
                  };

                  const processCollectBins = (callback) => {
                    if (!allowsCollect && !singleBinOnly) return callback();
                    const binsToProcess = collect_numbers.filter(e => e.bin_number?.trim());
                    if (binsToProcess.length === 0) return callback();

                    const processOne = (index) => {
                      if (index >= binsToProcess.length) return callback();

                      const binNumber = binsToProcess[index].bin_number.trim();

                      conn.query('SELECT bin_id, customer_id, bin_type_id FROM bins WHERE bin_number = ?', [binNumber], async (err, binResults) => {
                        if (err) return callback(err);
                        if (binResults.length === 0) return callback(new Error(`Bin ${binNumber} not found`));

                        const bin = binResults[0];
                        const jobBinNameLower = (job.bin_name || '').toLowerCase();
                        const isRoroTransport = jobBinNameLower.includes('roro');
                        const isSkipTransport = jobBinNameLower.includes('skip');

                        if (isRoroTransport || isSkipTransport) {
                          try {
                            const binTypeName = await new Promise((resolve, reject) => {
                              conn.query('SELECT bin_name FROM bintype WHERE bin_type_id = ?', [bin.bin_type_id], (err, rows) => {
                                if (err) return reject(err);
                                resolve((rows[0]?.bin_name || '').toLowerCase());
                              });
                            });
                            const keyword = isRoroTransport ? 'roro' : 'skip';
                            if (!binTypeName.includes(keyword)) {
                              return callback(new Error(`Bin ${binNumber} is not a ${keyword.toUpperCase()} bin`));
                            }
                          } catch (err) {
                            return callback(err);
                          }
                        } else if (!skipTypeCheck && bin.bin_type_id !== job.bin_type_id) {
                          return callback(new Error(`Bin ${binNumber} does not match job bin type`));
                        }

                        let fromLocation = 'Handled';
                        let toLocation = 'Handled';

                        const updateBinAndRecord = () => {
                          conn.query(
                            'INSERT INTO job_bins (job_id, bin_id, action, movement_type, created_at) VALUES (?, ?, ?, ?, NOW())',
                            [jobId, bin.bin_id, 'COLLECT', jobType.job_type_name.toUpperCase()],
                            (err) => {
                              if (err) return callback(err);
                              conn.query(
                                'INSERT INTO binhistory (bin_id, job_id, from_location, to_location, moved_by, moved_at) VALUES (?, ?, ?, ?, ?, NOW())',
                                [bin.bin_id, jobId, fromLocation, toLocation, userId],
                                (err) => {
                                  if (err) return callback(err);
                                  processOne(index + 1);
                                }
                              );
                            }
                          );
                        };

                        if (causesCustomerChange) {
                          getCustomerName(bin.customer_id, (err, custName) => {
                            if (err) return callback(err);
                            fromLocation = custName;
                            toLocation = 'STOCK COMPOUND/ASTON CHURCH ROAD';
                            conn.query(
                              'UPDATE bins SET customer_id = 4347, modified_by = ?, modified_at = NOW() WHERE bin_id = ?',
                              [userId, bin.bin_id],
                              (err) => {
                                if (err) return callback(err);
                                updateBinAndRecord();
                              }
                            );
                          });
                        } else {
                          updateBinAndRecord();
                        }
                      });
                    };

                    processOne(0);
                  };

                  const processDeliverBins = (callback) => {
                    if (!allowsDeliver) return callback();
                    const binsToProcess = deliver_numbers.filter(e => e.bin_number?.trim());
                    if (binsToProcess.length === 0) return callback();

                    const processOne = (index) => {
                      if (index >= binsToProcess.length) return callback();

                      const binNumber = binsToProcess[index].bin_number.trim();

                      conn.query('SELECT bin_id, customer_id, bin_type_id FROM bins WHERE bin_number = ?', [binNumber], async (err, binResults) => {
                        if (err) return callback(err);
                        if (binResults.length === 0) return callback(new Error(`Bin ${binNumber} not found`));

                        const bin = binResults[0];
                        const jobBinNameLower = (job.bin_name || '').toLowerCase();
                        const isRoroTransport = jobBinNameLower.includes('roro');
                        const isSkipTransport = jobBinNameLower.includes('skip');

                        if (isRoroTransport || isSkipTransport) {
                          try {
                            const binTypeName = await new Promise((resolve, reject) => {
                              conn.query('SELECT bin_name FROM bintype WHERE bin_type_id = ?', [bin.bin_type_id], (err, rows) => {
                                if (err) return reject(err);
                                resolve((rows[0]?.bin_name || '').toLowerCase());
                              });
                            });
                            const keyword = isRoroTransport ? 'roro' : 'skip';
                            if (!binTypeName.includes(keyword)) {
                              return callback(new Error(`Bin ${binNumber} is not a ${keyword.toUpperCase()} bin`));
                            }
                          } catch (err) {
                            return callback(err);
                          }
                        } else if (!skipTypeCheck && bin.bin_type_id !== job.bin_type_id) {
                          return callback(new Error(`Bin ${binNumber} does not match job bin type`));
                        }

                        let fromLocation = 'Handled';
                        let toLocation = 'Handled';

                        const updateBinAndRecord = () => {
                          conn.query(
                            'INSERT INTO job_bins (job_id, bin_id, action, movement_type, created_at) VALUES (?, ?, ?, ?, NOW())',
                            [jobId, bin.bin_id, 'DELIVER', jobType.job_type_name.toUpperCase()],
                            (err) => {
                              if (err) return callback(err);
                              conn.query(
                                'INSERT INTO binhistory (bin_id, job_id, from_location, to_location, moved_by, moved_at) VALUES (?, ?, ?, ?, ?, NOW())',
                                [bin.bin_id, jobId, fromLocation, toLocation, userId],
                                (err) => {
                                  if (err) return callback(err);
                                  processOne(index + 1);
                                }
                              );
                            }
                          );
                        };

                        if (causesCustomerChange) {
                          getCustomerName(bin.customer_id, (err, currentLocName) => {
                            if (err) return callback(err);
                            fromLocation = currentLocName;
                            getCustomerName(job.customer_id, (err, targetLocName) => {
                              if (err) return callback(err);
                              toLocation = targetLocName;
                              conn.query(
                                'UPDATE bins SET customer_id = ?, modified_by = ?, modified_at = NOW() WHERE bin_id = ?',
                                [job.customer_id, userId, bin.bin_id],
                                (err) => {
                                  if (err) return callback(err);
                                  updateBinAndRecord();
                                }
                              );
                            });
                          });
                        } else {
                          updateBinAndRecord();
                        }
                      });
                    };

                    processOne(0);
                  };

                  const processLugLocks = (callback) => {
                    if (lug_locks.length === 0) return callback();
                    let targetBinNumber = null;
                    if (jobType.job_type_name === 'Exchange' || allowsDeliver) {
                      targetBinNumber = deliver_numbers[0]?.bin_number;
                    } else if (allowsCollect || singleBinOnly) {
                      targetBinNumber = collect_numbers[0]?.bin_number;
                    }

                    const updateLugsAndJobLugs = (binId, cb) => {
                      conn.query(
                        'UPDATE lug_locks SET job_id = ?, location_id = ?, date_fitted = NOW(), issued_to = ? WHERE lug_id IN (?)',
                        [jobId, job.customer_id, userId, lug_locks],
                        (err) => {
                          if (err) return cb(err);
                          const jobLugValues = lug_locks.map(id => [jobId, id]);
                          conn.query('INSERT INTO job_lug_locks (job_id, lug_lock_id) VALUES ?', [jobLugValues], (err) => {
                            if (err) return cb(err);
                            if (binId) {
                              const lugBinValues = lug_locks.map(id => [id, binId, userId, new Date()]);
                              conn.query('INSERT INTO luglock_bins (lug_id, bin_id, assigned_by, assigned_at) VALUES ?', [lugBinValues], (err) => {
                                if (err) return cb(err);
                                cb();
                              });
                            } else {
                              cb();
                            }
                          });
                        }
                      );
                    };

                    if (!targetBinNumber) {
                      return updateLugsAndJobLugs(null, callback);
                    }

                    conn.query('SELECT bin_id FROM bins WHERE bin_number = ?', [targetBinNumber.trim()], (err, binResults) => {
                      if (err) return callback(err);
                      if (binResults.length === 0) return callback(new Error(`Bin ${targetBinNumber} not found for lug lock association`));
                      updateLugsAndJobLugs(binResults[0].bin_id, callback);
                    });
                  };

                  const handleInspectionRepair = (callback) => {
                    if (jobType.job_type_name === 'Inspection/Repair' && collect_numbers.length === 0 && deliver_numbers.length === 0) {
                      conn.query('UPDATE jobs SET modified_by = ?, modified_at = NOW() WHERE job_id = ?', [userId, jobId], (err) => {
                        if (err) return callback(err);
                        callback();
                      });
                    } else {
                      callback();
                    }
                  };

                  // ✅ Outer sequential pipeline — unchanged
                  processCollectBins((err) => {
                    if (err) return conn.rollback(() => { conn.release(); sendError(err.message); });
                    processDeliverBins((err) => {
                      if (err) return conn.rollback(() => { conn.release(); sendError(err.message); });
                      processLugLocks((err) => {
                        if (err) return conn.rollback(() => { conn.release(); sendError('Database error updating lug locks', 500); });
                        handleInspectionRepair((err) => {
                          if (err) return conn.rollback(() => { conn.release(); sendError('Database error', 500); });
                          conn.commit((err) => {
                            if (err) return conn.rollback(() => { conn.release(); sendError('Commit error', 500); });
                            conn.release();
                            sendResponse(200, { success: true });
                          });
                        });
                      });
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

app.post('/job/:job_id/signature', authenticateToken, async (req, res) => {
  const jobId = req.params.job_id;
  const { customer_name, customer_email, customer_signature, driver_comments, vehicle_reg } = req.body;
  const userId = req.user.userId;

  console.log(`[Signature] Submitting for job ${jobId}. Email: ${customer_email}`);

  const results = await queryWithConnection('SELECT job_status_id FROM job_status WHERE job_status_name = ?', ['Completed']);
  if (results.length === 0) {
    return res.status(404).json({ error: 'Status not found' });
  }
  const statusId = results[0].job_status_id;
  await queryWithConnection(`
      UPDATE jobs 
      SET customer_name = ?, 
          customer_email = ?,
          customer_signature = ?, 
          driver_comments = ?, 
          vehicle_reg = ?, 
          job_status_id = ?,
          modified_by = ?, 
          modified_at = NOW() 
      WHERE job_id = ?
    `, [customer_name, customer_email, customer_signature, driver_comments, vehicle_reg, statusId, userId, jobId]);
  res.json({ success: true });
});

app.post('/job/:job_id/waste-transfer-note', authenticateToken, async (req, res) => {
  const jobId = req.params.job_id;

  const results = await queryWithConnection(`
    SELECT 
      j.*, 
      wt.waste_type_name, 
      wt.pdf_field_name, 
      bt.bin_name, 
      c.company_name, 
      cr.customer_name as site_name,
      jt.job_type_name,
      js.job_status_name,
      CONCAT(u.first_name, ' ', u.last_name) AS driver_name,
      u.signature AS driver_signature
    FROM jobs j
    LEFT JOIN waste_types wt ON j.waste_type_id = wt.waste_type_id
    LEFT JOIN bintype bt ON j.bin_type_id = bt.bin_type_id
    LEFT JOIN company c ON j.company_id = c.company_id
    LEFT JOIN jobtype jt ON j.job_type_id = jt.job_type_id
    LEFT JOIN job_status js ON j.job_status_id = js.job_status_id
    LEFT JOIN users u ON j.assigned_to = u.user_id
    LEFT JOIN customer cr ON j.customer_id = cr.customer_id
    WHERE j.job_id = ?
  `, [jobId]);

  if (results.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const job = results[0];

  try {
    // -----------------------------
    // 1. Load PDF template
    // -----------------------------
    const templatePath = path.join(
      'C:',
      'inetpub',
      'wwwroot',
      'Transport-app',
      'storage',
      'pdfs',
      'WTN_template.pdf'
    );
    const binsQuery = `
  SELECT 
    jb.action,
    b.bin_number
  FROM job_bins jb
  JOIN bins b ON jb.bin_id = b.bin_id
  WHERE jb.job_id = ?
    AND jb.action IN ('COLLECT', 'DELIVER')
  ORDER BY jb.action, b.bin_number
`;
    const jobBins = await new Promise((resolve, reject) => {
      db.query(binsQuery, [jobId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
    const collectedBins = [];
    const deliveredBins = [];

    for (const row of jobBins) {
      if (row.action === 'COLLECT') {
        collectedBins.push(row.bin_number);
      } else if (row.action === 'DELIVER') {
        deliveredBins.push(row.bin_number);
      }
    }

    const jobTypeName = job.job_type_name || '';
    const collectedText = collectedBins.join(', ');
    const deliveredText = deliveredBins.join(', ');
    const allBinsText = [...new Set([...collectedBins, ...deliveredBins])].join(', ');

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // -----------------------------
    // 2. Fill text fields
    // (field names must match Acrobat)
    // -----------------------------
    const paddedJobId = String(job.job_id).padStart(6, '0');
    form.getTextField('job_id').setText(paddedJobId);
    form.getTextField('job_date').setText(
      new Date(job.job_date).toLocaleDateString()
    );

    form.getTextField('company_name').setText(job.company_name || '');
    form.getTextField('vehicle_reg').setText((job.vehicle_reg || '').toUpperCase());
    form.getTextField('site_name').setText(job.site_name || '');
    form.getTextField('recieved_by').setText(job.customer_name || '');
    form.getTextField('address').setText(job.address || '');
    form.getTextField('driver_name').setText(job.driver_name || '');
    form.getTextField('job_type').setText(job.job_type_name || '');
    form.getTextField('sic_code').setText(job.sic_code || '');
    form.getTextField('driver_comment').setText((job.driver_comments || '').toUpperCase());
    form.getTextField('bin_type').setText(job.bin_name || '');

    // Populate bin fields based on job type
    if (jobTypeName === 'Exchange') {
      form.getTextField('collected_bins').setText(collectedText);
      form.getTextField('delivered_bins').setText(deliveredText);
    } else if (jobTypeName === 'Collect' || jobTypeName === 'Collect Only') {
      form.getTextField('collected_bins').setText(collectedText);
      form.getTextField('delivered_bins').setText('');
    } else if (jobTypeName === 'Deliver' || jobTypeName === 'Deliver Only') {
      form.getTextField('delivered_bins').setText(deliveredText);
      form.getTextField('collected_bins').setText('');
    } else {
      // For any other jobtype like Tip and return and others, use this field to insert bin numbers ( bin_numbers).
      try {
        form.getTextField('bin_numbers').setText(allBinsText);
      } catch (e) {
        console.warn('PDF field "bin_numbers" not found in template');
      }
      form.getTextField('collected_bins').setText('');
      form.getTextField('delivered_bins').setText('');
    }



    // -----------------------------
    // 3. Tick waste checkboxes
    // -----------------------------
    const wasteField = job.pdf_field_name;
    if (wasteField) {
      form.getCheckBox(wasteField).check();
    }

    // -----------------------------
    // 4. Inject customer signature
    // -----------------------------

    if (job.customer_signature) {
      const match = job.customer_signature.match(/^data:image\/(png|jpeg|jpg);base64,/);

      if (!match) {
        throw new Error('Invalid signature image format');
      }

      const imageType = match[1];
      const base64 = job.customer_signature.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Buffer.from(base64, 'base64');

      const page = pdfDoc.getPages()[0];
      const { height } = page.getSize();
      const CM_TO_PTS = 28.3465;

      const signatureImage =
        imageType === 'png'
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);

      page.drawImage(signatureImage, {
        x: 11.735 * CM_TO_PTS,
        y: height - (11.16 * CM_TO_PTS) - (1.2 * CM_TO_PTS),
        width: 4.5 * CM_TO_PTS,
        height: 1.2 * CM_TO_PTS,
      });
    }

    // -----------------------------
    // 4b. Inject driver signature
    // -----------------------------
    if (job.driver_signature) {
      try {
        const match = job.driver_signature.match(/^data:image\/(png|jpeg|jpg);base64,/);
        if (match) {
          const imageType = match[1];
          const base64 = job.driver_signature.replace(/^data:image\/\w+;base64,/, '');
          const imageBytes = Buffer.from(base64, 'base64');

          const page = pdfDoc.getPages()[0];
          const { height } = page.getSize();
          const CM_TO_PTS = 28.3465;

          const driverSigImage =
            imageType === 'png'
              ? await pdfDoc.embedPng(imageBytes)
              : await pdfDoc.embedJpg(imageBytes);

          // Positioning at bottom middle (approximate, adjust as needed)
          page.drawImage(driverSigImage, {
            x: 6.5 * CM_TO_PTS, // Horizontal middle-ish
            y: height - (11.16 * CM_TO_PTS) - (1.2 * CM_TO_PTS),
            width: 4.0 * CM_TO_PTS,
            height: 1.0 * CM_TO_PTS,
          });
        }
      } catch (e) {
        console.error('Failed to embed driver signature:', e);
      }
    }



    // -----------------------------
    // 5. Flatten form (important)
    // -----------------------------
    form.flatten();

    // -----------------------------
    // 6. Save output PDF
    // -----------------------------
    const pdfBytes = await pdfDoc.save();

    const dateObj = new Date(job.job_date);
    const normalDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;

    // Sanitize site name to prevent EPERM errors from invalid characters like / : * ? " < > |
    const sanitizedSiteName = (job.site_name || 'Job').replace(/[/\\?%*:|"<>]/g, '_').trim();

    const fileName = `WTN_${sanitizedSiteName}_${paddedJobId}_${normalDate}.pdf`;

    // Ensure pdfsDir is defined (moved definition here for clarity)
    const pdfsDir = path.join('C:', 'inetpub', 'wwwroot', 'Transport-app', 'storage', 'pdfs');
    const outputPath = path.join(pdfsDir, fileName);

    fs.writeFileSync(outputPath, pdfBytes);

    // -----------------------------
    // 7. Send email with PDF
    // -----------------------------
    try {
      await emailService.sendWTNEmail(db, jobId, outputPath, fileName);
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr);
      // We don't fail the request if email sending fails, as the PDF was generated successfully
    }

    res.json({
      success: true,
      pdfUrl: `/storage/pdfs/${fileName}`,
      fileName
    });

  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});


const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
