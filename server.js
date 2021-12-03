// Importing required modules
const cors      = require('cors');
const express   = require('express');
const es        = require('express-session')
const fs        = require("fs");
const jwt       = require("jsonwebtoken");

// parse env variables
require('dotenv').config();

require("./helpers/db/mongodb.js")();

// Configuring port
const port = process.env.PORT || 5555;
const app = express();

app.set('trust proxy', 1)

// Configure express session options
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

app.use(cors({origin: ['https://scrumbers-client.herokuapp.com', 'https://localhost:8080', 'https://localhost:8081'], credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization']}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'html');

// Static folder
app.use(express.static(__dirname + '/views/'));

// Request middleware to verify JWT token on every request
app.use((req,res, next) => {
    console.log(req.originalUrl)
    let url = req.originalUrl.split('?')[0];
    console.log(url);
    switch(true)
    {
        // First visit to the app
        case ['/api/user/login', '/api/user/login/microsoft', '/api/user/auth/microsoft', '/api/session/check', '/api/session/logout', '/api/user/register'].indexOf(url) >= 0 :
            next()
            break;

        default:
            jwt.verify(req.headers['authorization'], process.env.JWT_TOKEN_SECRET, (err, decoded) => {
                decoded === undefined ? res.status(200).send({error: err, message: 'invalid token', secret: process.env.JWT_TOKEN_SECRET, token: req.headers['authorization']}) : next()
            });
    }
})

// Defining route middleware
app.use('/api', require('./routes/api'));

if(process.env.PRODUCTION_CONFIG)
{
    const server    = app.listen(port)
    const io        = require('socket.io')(server, {cors: {origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"], credentials: true}})
    require('./helpers/socketServer')(io);
}
else
{
    const https     = require('https');
    const server    = https.createServer({key: fs.readFileSync('./localhost-key.pem'), cert: fs.readFileSync('./localhost.pem'),}, app);
    const io        = require('socket.io')(server, {cors: {origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"], credentials: true}})
    require('./helpers/socketServer')(io);
    server.listen(port)
}

console.log(`Listening On https://localhost:${port}/api`);
module.exports = app;
