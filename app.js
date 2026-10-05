require('dotenv').config();

const express = require('express');
const pool = require('../src/configs/db');
const router = require('./routes/import');
const { startImportConsumer } = require('./services/import-event');

const app = express();

app.use(express.json())

app.use("/api",router)

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

let PORT = 4112

app.listen(PORT,()=>{
    console.log(`Listening on port:${PORT}`);

    startImportConsumer();
})