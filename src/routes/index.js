var express = require('express');
const path = require("node:path");
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.status(403).send('<h1>Wait, What?? Why are you here?</h1>');
});

module.exports = router;
