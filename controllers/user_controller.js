'use strict';

// Imports
const jwt       = require('jsonwebtoken');
const fs        = require('fs');
const bcrypt    = require('bcrypt');

const User = require('../models/user_schema');

const createData = (req, res) => {
    User.create(req.body)
        .then((data) => {
            console.log('New User Created!', data);
            res.status(201).json(data);
        })
        .catch((err) => {
            if (err.name === 'ValidationError') {
                console.error('Error Validating!', err);
                res.status(422).json(err);
            } else {
                console.error(err);
                res.status(500).json(err);
            }
        });
};

const readData = (req, res) => {
    User.find()
        .then((data) => {
            res.status(200).json(data);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json(err);
        });
};

const updateData = (req, res) => {
    User.findByIdAndUpdate(req.params.id, req.body, {
        useFindAndModify: false,
        new: true,
    })
        .then((data) => {
            console.log('User updated!');
            res.status(201).json(data);
        })
        .catch((err) => {
            if (err.name === 'ValidationError') {
                console.error('Error Validating!', err);
                res.status(422).json(err);
            } else {
                console.error(err);
                res.status(500).json(err);
            }
        });
};

const deleteData = (req, res) => {
    User.findById(req.params.id)
        .then((data) => {
            if (!data) {
                throw new Error('User not available');
            }
            return data.remove();
        })
        .then((data) => {
            console.log('User removed!');
            res.status(200).json(data);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json(err);
        });
};

/**
 * POST /user/login
 * Lets you login as a user
 * @param {Request} req
 * @param {Response} res
 */
const login = (req, res) => {
    User.find({email: req.body.email})
        .then(data => {
            if (data.length === 0) res.json(
                {
                    error: "Gebruiker niet gevonden",
                    field: "email"
                })
            else {
                bcrypt.compare(req.body.password, data[0].password)
                    .then(result => {
                        if (result) {
                            let key = null;
                            // Check if we have a jwt server key file
                            // If not create a new server key and put it in .jwtkey
                            if (fs.existsSync('.jwtkey'))
                              key = fs.readFileSync('.jwtkey');
                            else {
                              key = require('crypto').createHash('md5').update(JSON.stringify(process.env)).digest("hex");
                              fs.writeFileSync('.jwtkey', key); // Safe the key to file
                            }

                            // Create a json webtoken to use for api calls
                            let token = jwt.sign({
                                                   userName : data.name,
                                                   userEmail : data.email
                                               }, key);

                            // Send a response containing the token
                            res.json(
                                {
                                    meta : {
                                        count : 1
                                    },
                                    data : [
                                        {
                                            token : token
                                        }
                                    ]
                                }
                            );
                        } else {
                            res.json(
                                {
                                    error : 'Onjuist wachtwoord',
                                    field : 'password'
                                }
                            );
                        }
                    })
                    .catch(err => {
                        res.json({ error: err.message });
                    });
            }
        })
        .catch(err => {
            res.json({ error: err.message });
        });
}

module.exports = {
    createData,
    readData,
    updateData,
    deleteData,
    login
};