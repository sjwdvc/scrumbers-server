// Importing required modules
const cors      = require('cors');
const express   = require('express');
const session   = require('express-session');

// parse env variables
require('dotenv').config();

require("./helpers/db/mongodb.js")();

// Configuring port
const port = process.env.PORT || 5555;

const app = express();

// Configure middlewares

app.set('trust proxy', 1);

app.use(session({
    secret: 'ssshhhhh',
    saveUninitialized: true,
    resave: true,
    secure: true,
    cookie: {
        sameSite:'none',
        secure:true
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
app.listen(port);
console.log(`Listening On http://localhost:${port}/api`);

module.exports = app;
