const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl:{
        rejectUnauthorized: false
    },

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000,
})

pool.on("error", (error) => {
    console.error(
        "Unexpected PostgreSQL idle client error:",
        error
    );
});

module.exports = pool;