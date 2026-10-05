const express = require("express");
const bulkImport = require("../services/import");


const router = express.Router();

router.post("/imports",bulkImport)

module.exports = router;