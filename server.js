const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'rwanda_ride',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const pool = new Pool(dbConfig);
let dbMode = 'local-memory';

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const adminFiles = ['index.html', 'user-dashboard.html', 'owner-dashboard.html', 'admin-dashboard.html', 'style.css', 'script.js'];

async function initDb() {
  let client;

  try {
    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active'
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(80) NOT NULL,
        status VARCHAR(50) DEFAULT 'Available',
        rate DECIMAL(10,2) DEFAULT 0,
        image_url TEXT,
        owner_name VARCHAR(100)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(100) NOT NULL,
        vehicle_name VARCHAR(150) NOT NULL,
        booking_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        total_amount DECIMAL(10,2) DEFAULT 0
      );
    `);

    const seedUsers = `
      INSERT INTO users (name, email, role, status)
      VALUES
        ('Jean Paul', 'jean@example.com', 'Customer', 'Active'),
        ('Claudine', 'claudine@example.com', 'Customer', 'Active'),
        ('Alex', 'alex@rwandaride.com', 'Business Owner', 'Active'),
        ('Admin', 'admin@rwandaride.com', 'Admin', 'Active')
      ON CONFLICT (email) DO NOTHING;
    `;

    await client.query(seedUsers);

    const seedVehicles = `
      INSERT INTO vehicles (name, type, status, rate, image_url, owner_name)
      VALUES
        ('Toyota Land Cruiser', 'SUV', 'Available', 120.00, 'pic11.jpeg', 'Alex'),
        ('RAV4', 'SUV', 'Available', 95.00, 'pic3.jpeg', 'Alex'),
        ('Safari 4x4', '4x4', 'Booked', 150.00, 'pic4.jpeg', 'Alex'),
        ('Mini Van', 'Van', 'Available', 75.00, 'pic5.jpeg', 'Alex')
      ON CONFLICT DO NOTHING;
    `;

    await client.query(seedVehicles);

    const seedBookings = `
      INSERT INTO bookings (customer_name, vehicle_name, booking_date, status, total_amount)
      VALUES
        ('Thomas', 'Toyota Land Cruiser', '2026-09-15', 'Confirmed', 360.00),
        ('Mike', 'RAV4', '2026-09-18', 'Pending', 190.00),
        ('Celina', 'Safari 4x4', '2026-09-20', 'Confirmed', 300.00)
      ON CONFLICT DO NOTHING;
    `;

    await client.query(seedBookings);

    dbMode = 'postgresql';
    console.log('Connected to PostgreSQL successfully.');
    return true;
  } catch (error) {
    dbMode = 'local-memory';
    console.warn('PostgreSQL not available yet. Using in-memory data until the database is connected.');
    console.warn(error.message);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}

const memoryStore = {
  users: [
    { id: 1, name: 'Jean Paul', email: 'jean@example.com', role: 'Customer', status: 'Active' },
    { id: 2, name: 'Claudine', email: 'claudine@example.com', role: 'Customer', status: 'Active' },
    { id: 3, name: 'Alex', email: 'alex@rwandaride.com', role: 'Business Owner', status: 'Active' },
    { id: 4, name: 'Admin', email: 'admin@rwandaride.com', role: 'Admin', status: 'Active' },
  ],
  vehicles: [
    { id: 1, name: 'Toyota Land Cruiser', type: 'SUV', status: 'Available', rate: 120, image_url: 'pic11.jpeg', owner_name: 'Alex' },
    { id: 2, name: 'RAV4', type: 'SUV', status: 'Available', rate: 95, image_url: 'pic3.jpeg', owner_name: 'Alex' },
    { id: 3, name: 'Safari 4x4', type: '4x4', status: 'Booked', rate: 150, image_url: 'pic4.jpeg', owner_name: 'Alex' },
    { id: 4, name: 'Mini Van', type: 'Van', status: 'Available', rate: 75, image_url: 'pic5.jpeg', owner_name: 'Alex' },
  ],
  bookings: [
    { id: 1, customer_name: 'Thomas', vehicle_name: 'Toyota Land Cruiser', booking_date: '2026-09-15', status: 'Confirmed', total_amount: 360 },
    { id: 2, customer_name: 'Mike', vehicle_name: 'RAV4', booking_date: '2026-09-18', status: 'Pending', total_amount: 190 },
    { id: 3, customer_name: 'Celina', vehicle_name: 'Safari 4x4', booking_date: '2026-09-20', status: 'Confirmed', total_amount: 300 },
  ],
};

function getStore() {
  return memoryStore;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: dbMode });
});

app.get('/api/users', async (req, res) => {
  if (dbMode === 'postgresql') {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    return res.json(result.rows);
  }

  res.json(getStore().users);
});

app.post('/api/users', async (req, res) => {
  const { name, email, role, status } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (dbMode === 'postgresql') {
    try {
      const result = await pool.query(
        'INSERT INTO users (name, email, role, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, email, role, status || 'Active']
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const user = { id: Date.now(), name, email, role, status: status || 'Active' };
  getStore().users.push(user);
  res.status(201).json(user);
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  if (dbMode === 'postgresql') {
    try {
      const result = await pool.query(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), status = COALESCE($4, status) WHERE id = $5 RETURNING *',
        [req.body.name, req.body.email, req.body.role, req.body.status, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const index = getStore().users.findIndex((item) => item.id == id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  getStore().users[index] = { ...getStore().users[index], ...req.body };
  res.json(getStore().users[index]);
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  if (dbMode === 'postgresql') {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ success: true });
  }

  const lengthBefore = getStore().users.length;
  getStore().users = getStore().users.filter((item) => item.id != id);
  if (getStore().users.length === lengthBefore) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

app.get('/api/vehicles', async (req, res) => {
  if (dbMode === 'postgresql') {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY id ASC');
    return res.json(result.rows);
  }

  res.json(getStore().vehicles);
});

app.post('/api/vehicles', async (req, res) => {
  const { name, type, status, rate, image_url, owner_name } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  if (dbMode === 'postgresql') {
    try {
      const result = await pool.query(
        'INSERT INTO vehicles (name, type, status, rate, image_url, owner_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, type, status || 'Available', Number(rate || 0), image_url || 'pic11.jpeg', owner_name || 'Alex']
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const vehicle = { id: Date.now(), name, type, status: status || 'Available', rate: Number(rate || 0), image_url: image_url || 'pic11.jpeg', owner_name: owner_name || 'Alex' };
  getStore().vehicles.push(vehicle);
  res.status(201).json(vehicle);
});

app.put('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;

  if (dbMode === 'postgresql') {
    try {
      const result = await pool.query(
        'UPDATE vehicles SET name = COALESCE($1, name), type = COALESCE($2, type), status = COALESCE($3, status), rate = COALESCE($4, rate), image_url = COALESCE($5, image_url), owner_name = COALESCE($6, owner_name) WHERE id = $7 RETURNING *',
        [req.body.name, req.body.type, req.body.status, req.body.rate, req.body.image_url, req.body.owner_name, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const index = getStore().vehicles.findIndex((item) => item.id == id);
  if (index === -1) return res.status(404).json({ error: 'Vehicle not found' });
  getStore().vehicles[index] = { ...getStore().vehicles[index], ...req.body, rate: Number(req.body.rate || getStore().vehicles[index].rate) };
  res.json(getStore().vehicles[index]);
});

app.delete('/api/vehicles/:id', async (req, res) => {
  const { id } = req.params;

  if (dbMode === 'postgresql') {
    const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    return res.json({ success: true });
  }

  const lengthBefore = getStore().vehicles.length;
  getStore().vehicles = getStore().vehicles.filter((item) => item.id != id);
  if (getStore().vehicles.length === lengthBefore) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ success: true });
});

app.get('/api/bookings', async (req, res) => {
  if (dbMode === 'postgresql') {
    const result = await pool.query('SELECT * FROM bookings ORDER BY id ASC');
    return res.json(result.rows);
  }

  res.json(getStore().bookings);
});

app.post('/api/bookings', async (req, res) => {
  const { customer_name, vehicle_name, booking_date, status, total_amount } = req.body;
  if (!customer_name || !vehicle_name || !booking_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (dbMode === 'postgresql') {
    try {
      const result = await pool.query(
        'INSERT INTO bookings (customer_name, vehicle_name, booking_date, status, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [customer_name, vehicle_name, booking_date, status || 'Pending', Number(total_amount || 0)]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const booking = { id: Date.now(), customer_name, vehicle_name, booking_date, status: status || 'Pending', total_amount: Number(total_amount || 0) };
  getStore().bookings.push(booking);
  res.status(201).json(booking);
});

app.put('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;

  if (dbMode === 'postgresql') {
    try {
      const result = await pool.query(
        'UPDATE bookings SET customer_name = COALESCE($1, customer_name), vehicle_name = COALESCE($2, vehicle_name), booking_date = COALESCE($3, booking_date), status = COALESCE($4, status), total_amount = COALESCE($5, total_amount) WHERE id = $6 RETURNING *',
        [req.body.customer_name, req.body.vehicle_name, req.body.booking_date, req.body.status, req.body.total_amount, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const index = getStore().bookings.findIndex((item) => item.id == id);
  if (index === -1) return res.status(404).json({ error: 'Booking not found' });
  getStore().bookings[index] = { ...getStore().bookings[index], ...req.body, total_amount: Number(req.body.total_amount || getStore().bookings[index].total_amount) };
  res.json(getStore().bookings[index]);
});

app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;

  if (dbMode === 'postgresql') {
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.json({ success: true });
  }

  const lengthBefore = getStore().bookings.length;
  getStore().bookings = getStore().bookings.filter((item) => item.id != id);
  if (getStore().bookings.length === lengthBefore) return res.status(404).json({ error: 'Booking not found' });
  res.json({ success: true });
});

app.get('/api/dashboard', async (req, res) => {
  if (dbMode === 'postgresql') {
    const [users, vehicles, bookings] = await Promise.all([
      pool.query('SELECT * FROM users ORDER BY id ASC'),
      pool.query('SELECT * FROM vehicles ORDER BY id ASC'),
      pool.query('SELECT * FROM bookings ORDER BY id ASC'),
    ]);

    return res.json({
      users: users.rows,
      vehicles: vehicles.rows,
      bookings: bookings.rows,
    });
  }

  const store = getStore();
  res.json({
    users: store.users,
    vehicles: store.vehicles,
    bookings: store.bookings,
  });
});

app.get('*', (req, res, next) => {
  if (adminFiles.includes(path.basename(req.path))) {
    return res.sendFile(path.join(__dirname, path.basename(req.path)));
  }

  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(__dirname, 'index.html'));
});

(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Rwanda Ride app running on http://localhost:${PORT}`);
    console.log(`PostgreSQL config: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  });
})();
