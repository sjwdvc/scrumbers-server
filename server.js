// Importing required modules
const cors      = require('cors');
const express   = require('express');
const session   = require('express-session');
const https     = require('https');
const fs        = require("fs");

// parse env variables
require('dotenv').config();

require("./helpers/db/mongodb.js")();

// Configuring port
const port = process.env.PORT || 5555;

const app = express();

// Configure middlewares

app.use(session({
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

// Listening to port
const server    = https.createServer(app);
const io        = require('socket.io')(server);

// Start the socket server
require('./helpers/socketServer')(io);

server.listen(port);

console.log(`Listening On https://localhost:${port}/api`);

module.exports = app;
