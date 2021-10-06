// Importing required modules
const cors      = require('cors');
const express   = require('express');
const es        = require('express-session');
const fs        = require("fs");

// parse env variables
require('dotenv').config();

require("./helpers/db/mongodb.js")();

// Configuring port
const port = process.env.PORT || 5555;
const app = express();

app.set('trust proxy', 1)

// Configure middlewares

app.use(es({
    secret: 'ssshhhhh',
    saveUninitialized: true,
    resave: true,
    secure: true,
    cookie: {
        sameSite:'none',
        secure: true
    }
}));

app.use(cors({origin: ['https://scrumbers-client.herokuapp.com/', '*'], methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization']}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'html');

// Static folder
app.use(express.static(__dirname + '/views/'));

// Defining route middleware
app.use('/api', require('./routes/api'));

// Local Config (https)
// const https  = require('https');
// const server    = https.createServer({
//                                      key: fs.readFileSync('./localhost-key.pem'),
//                                      cert: fs.readFileSync('./localhost.pem'),
//                                      }, app);
// const io        = require('socket.io')(server);
// require('./helpers/socketServer')(io);
// server.listen(port)

// Heroku config
const server    = app.listen(port)
const io        = require('socket.io')(server);
require('./helpers/socketServer')(io);

console.log(`Listening On https://localhost:${port}/api`);

module.exports = app;
