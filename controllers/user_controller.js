'use strict';

// Imports
const jwt       = require('jsonwebtoken');
const fs        = require('fs');
const bcrypt    = require('bcrypt');
const harms     = /[!#$%^&*()_+\-=\[\]{};':"\\|,<>\/?]+/;
const session   = require('express-session')

const User = require('../models/user_schema');

const register = (req, res) => {
    // Check if the user already exists in the database
    User.find({email : req.body.email})
        .then(data => {
            // If no data is found, continue validation, else return an error message to display
            if (data.length === 0) {
                // If password is not 8 characters
                if (req.body.password.length < 8) {
                    res.json
                       (
                           {
                               error : 'Wachtwoord moet tenminste 8 karakters bevatten',
                               field : 'password'
                           }
                       )
                } else if(!req.body.password.split("").some(letter => letter === letter.toUpperCase())) {
                    res.json
                       (
                           {
                               error : 'Wachtwoord moet tenminste 1 hoofdletter bevatten',
                               field : 'password'
                           }
                       )
                } else if(!req.body.password.split("").some(v => [...Array(10).keys()].includes(parseInt(v)))) {
                    res.json
                       (
                           {
                               error : 'Wachtwoord moet tenminste 1 cijfer bevatten',
                               field : 'password',
                           }
                       )
                } else {
                    if (Object.values(req.body).some(value => harms.test(value))) {
                        res.json
                           ({
                                error : 'Je gebruikt karakters die niet zijn toegestaan',
                                field : Object.keys(req.body).find(k => req.body[k] === Object.values(req.body).find(value => harms.test(value)))
                            })
                    } else
                    {
                        // Hash password after validation and before inserting into database
                        bcrypt.hash(req.body.password, 10)
                              .then(passwdHash => {
                                  // When the hash is done we set the password to the hased version
                                  req.body.password = passwdHash;

                                  // Insert database record
                                  User.create(req.body)
                                      .then(data => {
                                          req.session.token = generateToken([data])
                                          res.status(200).json({ })
                                      })
                                      .catch((err) => res.status(500).json({ error: err.message }));
                              })
                              .catch(err => res.status(500).json({ error: err.message }))
                    }
                }
            } else {
                res.json
                   (
                       {
                           error : 'Email is al in gebruik',
                           field : 'email'
                       }
                   )
            }
        })
        .catch(err => {
            res.status(500).json(err)
        })
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
                            req.session.token = generateToken(data)

                            // Send a response containing the token
                            res.status(200).json(
                                {
                                    meta : {
                                        count : 1
                                    },
                                    data : [
                                        {
                                            token : req.session.token
                                        }
                                    ],
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

const generateToken = data => {
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
    return jwt.sign({userName : data[0].name, userEmail : data[0].email}, key);
}

module.exports = {
    register,
    readData,
    updateData,
    deleteData,
    login
};
