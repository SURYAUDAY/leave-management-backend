const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ['https://leave-management-frontend.onrender.com', 'http://localhost:5173'], // Add allowed origins here
};

app.use(cors(corsOptions));

app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
});

const testDbConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    console.log('Connected to the database successfully');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  } finally {
    client.release();
  }
};

testDbConnection();

app.post('/events', async (req, res) => {
  const events = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const query = 'INSERT INTO events (title, start, "end") VALUES ($1, $2, $3) RETURNING *';
    const insertedEvents = [];
    for (let event of events) {
      const result = await client.query(query, [event.title, event.start, event.end]);
      insertedEvents.push(result.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).send(insertedEvents);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting events:', error);
    res.status(500).send(error);
  } finally {
    client.release();
  }
});

app.get('/events', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM events ORDER BY start');
    res.send(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send(error);
  } finally {
    client.release();
  }
});

app.put('/events/:id', async (req, res) => {
  const eventId = req.params.id;
  const { title, start, end } = req.body;
  const client = await pool.connect();
  try {
    const query = 'UPDATE events SET title = $1, start = $2, "end" = $3 WHERE id = $4 RETURNING *';
    const result = await client.query(query, [title, start, end, eventId]);
    if (result.rows.length > 0) {
      res.status(200).send(result.rows[0]);
    } else {
      res.status(404).send({ message: 'Event not found' });
    }
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).send(error);
  } finally {
    client.release();
  }
});

app.delete('/events/:id', async (req, res) => {
  const eventId = req.params.id;
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM events WHERE id = $1', [eventId]);
    if (result.rowCount > 0) {
      res.status(200).send({ message: 'Event deleted successfully' });
    } else {
      res.status(404).send({ message: 'Event not found' });
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).send(error);
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
