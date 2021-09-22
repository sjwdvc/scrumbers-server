'use strict';

const User      = require('../models/user_schema');
const bcrypt    = require("bcrypt");
const harms     = /[!#$%^&*()_+\-=\[\]{};':"\\|,<>\/?]+/;

const createUser = (req, res) => {

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
                } else {
                    if (Object.values(req.body).some(value => harms.test(value))) {
                        res.json
                           ({
                                error : 'Je gebruikt karakters die niet zijn toegstaan',
                                field : Object.keys(req.body).find(k => req.body[k] === Object.values(req.body).find(value => harms.test(value)))
                            })
                    } else {

                        // Hash password after validation and before inserting into database
                        req.body.password = bcrypt.hashSync(req.body.password,10);

                        // Insert database record
                        User.create(req.body)
                            .then()
                            .catch((err) => res.status(500).json(err));
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

const readUsers = (req, res) => {
    User.find()
        .then((data) => {
            res.status(200).json(data);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json(err);
        });
};

const updateUser = (req, res) => {
    User.findByIdAndUpdate(req.params.id, req.body, {
        useFindAndModify : false,
        new : true,
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

const deleteUser = (req, res) => {
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

module.exports = {
    createUser,
    readUsers,
    updateUser,
    deleteUser,
};
