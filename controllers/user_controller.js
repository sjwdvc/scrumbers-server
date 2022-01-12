'use strict';

// Imports
const jwt       = require('jsonwebtoken');
const fs        = require('fs');
const bcrypt    = require('bcrypt');
const harms     = /[!#$%^&*()_+\-=\[\]{};':"\\|,<>\/?]+/;
const session   = require('express-session')
const msal      = require('@azure/msal-node');
const server    = require('../server');
const { User, ACCOUNT_TYPE } = require('../models/user_schema')

const register = (req, res) => {
    // Check if the user already exists in the database
    User.find({name: req.body.name})
        .then(name => {
            if(name.length === 0)
            {
                User.find({email : req.body.email})
                    .then(data => {
                        // If no data is found, continue validation, else return an error message to display
                        if (data.length === 0) {
                            // If password is not 8 characters
                            if (req.body.password.length < 8)
                            {
                                res.json
                                   (
                                       {
                                           error : 'Password requires at least 8 characters',
                                           field : 'password'
                                       }
                                   )
                            }
                            // If password doesn't include a capital letter
                            else if(!req.body.password.split("").some(letter => letter === letter.toUpperCase()))
                            {
                                res.json
                                   (
                                       {
                                           error : 'Password requires at least 1 capital letter',
                                           field : 'password'
                                       }
                                   )
                            }

                            // If password doesn't include a number
                            else if(!req.body.password.split("").some(v => [...Array(10).keys()].includes(parseInt(v))))
                            {
                                res.json
                                   (
                                       {
                                           error : 'Password requires at least 1 number',
                                           field : 'password',
                                       }
                                   )
                            }
                            else
                            {
                                if (Object.values(req.body).some(value => harms.test(value))) {
                                    res.json
                                       ({
                                            error : 'Some characters are not allowed',
                                            field : Object.keys(req.body).find(k => req.body[k] === Object.values(req.body).find(value => harms.test(value)))
                                        })
                                } else
                                {
                                    // Hash password after validation and before inserting into database
                                    bcrypt.hash(req.body.password, 10)
                                          .then(passwdHash => {
                                              // When the hash is done we set the password to the hashed version
                                              req.body.password = passwdHash;
                                              req.body.templates = [
                                                  {
                                                      title: "Standard template",
                                                      cards: [-2, -1, 0, 1, 3, 5, 8, 13, 20, 40, 100]
                                                  }
                                              ]

                                              // Insert database record
                                              User.create(req.body)
                                                  .then(data => {

                                                      // Set session variables
                                                      req.session.token = generateToken([data]);
                                                      req.session.name  = req.body.name;
                                                      req.session.email = req.body.email;

                                                      res.status(200).json({});
                                                  })
                                                  .catch((err) => res.status(500).json({ error: err.message }));
                                          })
                                          .catch(err => res.status(500).json({ error: err.message }))
                                }
                            }
                        }
                        else
                        {
                            res.json
                               (
                                   {
                                       error : 'Email is already taken',
                                       field : 'email'
                                   }
                               )
                        }
                    })
                    .catch(err => {
                        res.status(500).json(err)
                    })
            }
            else
            {
                res.json
                   (
                       {
                           error : 'Username is already taken',
                           field : 'name'
                       }
                   )
            }
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

const userData = (req, res) => {

    // Get user data from database
    User.find({email: req.session.email})
    .then((data) => {
        res.status(200).json({
            name:       data[0].name || '',
            email:      data[0].email || '',
            age:        data[0].age || 0,
            function:   data[0].function || ''
                             });
    })
};

const updateUser = (req, res) => { 
    // Check if all fields are filled
    if(req.body.age.length > 0 && req.body.name.length > 0 && req.body.function.length > 0 ){
    // Check for harming characters
        if (Object.values(req.body).some(value => harms.test(value))) {
            res.json
                ({
                    error : 'Some characters are not allowed',
                })
        } else{
            // Update user information
            res.json
            ({
                error : "" 
            })
            console.log("Body name: "+ req.body.name);
            console.log("Session name: "+ req.session.name);
            req.session.name = req.body.name;
            console.log("NEW Session name: "+ req.session.name);

            User.updateOne({email: req.session.email}, { name: req.body.name , age : req.body.age, function : req.body.function}, { upsert: true }, (err, res) => console.log(err, res))
        }
    } else{
        res.json
            ({
                error : 'Please fill out all the fields'
            })
    }
    
}

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
                    error: "User not found",
                    field: "email"
                })
            else
            {
                bcrypt.compare(req.body.password, data[0].password)
                      .then(result => {
                          if (result)
                          {
                              // Set session properties
                              req.session.token = generateToken(data)
                              req.session.email = req.body.email

                              User.find({email : req.body.email})
                                  .then(data => {
                                      req.session.name = data[0].name
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
                                  })
                          }
                          else
                          {
                              res.json(
                                  {
                                      error : 'Invalid password',
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

const cca = new msal.ConfidentialClientApplication({
    auth: {
        clientId:       process.env.MS_CLIENTID,
        authority:      process.env.MS_AUTHORITY,
        clientSecret:   process.env.MS_CLIENTSECRET,
    },
    system: {
        loggerOptions: {
            loggerCallback(logLevel, message, containsPii)
            {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Verbose
        }
    }
});
const loginMicrosoft = (req, res) => {
    const authUrlParams = {
        scopes: ["user.read"],
        // TODO:
        // Get server info (url/port)
        redirectUri: `${req.protocol}://${server.hostname}/api/user/auth/microsoft`
    }
    console.log("Redirect url: ", `${req.protocol}://${server.hostname}/api/user/auth/microsoft`)
    cca.getAuthCodeUrl(authUrlParams)
        .then(response => {
            res.status(200).json(
                {
                    oauthUrl: response
                }
            );
        }).catch(err => {
            console.log(err);
            res.status(500).json(
                {
                    error: 'Error when creating url'
                }
            )
        });
}
const authMicrosoft = (req, res) => {
    if (!req?.query?.code) {
        res.sendStatus(500);
        return;
    }
    console.log("Redirect url: ", `${req.protocol}://${server.hostname}/api/user/auth/microsoft`)
    const tokenRequest = {
        code: req.query.code,
        scopes: ["user.read"],
        redirectUri: `${req.protocol}://${server.hostname}/api/user/auth/microsoft`
    };

    cca.acquireTokenByCode(tokenRequest)
        .then(response => {
            // Insert database record
            User.find({ email: response.account.username, accountType: ACCOUNT_TYPE.MICROSOFT })
                .then(found => {
                    // Check if we found an account in our database
                    if(found.length === 0)
                    {
                        // if not we create an account in our database
                        User.create({
                            name        : response.account.name || response.account.username,
                            email       : response.account.username,
                            accountType : ACCOUNT_TYPE.MICROSOFT,
                            password    : "none"
                        }).then(acc => {
                            // Set session variables
                            req.session.token = generateToken([acc]);
                            req.session.name  = response.account.name || response.account.username;
                            req.session.email = response.account.username;
                            res.redirect(`${req.protocol}://${server.clienthost}/login?token=${req.session.token}`);
                        }).catch(err => res.status(500).json({ when: 'creating user', error: err.message }));
                    }
                    else
                    {
                        // Else check if the found account is a miscrosoft account
                        if (found[0].accountType != ACCOUNT_TYPE.MICROSOFT)
                        {
                            res.status(403).json({
                                error: 'Can not login as Microsoft with a non Microsoft account'
                            });
                        }
                        else
                        {
                            req.session.token = generateToken(found);
                            req.session.name  = response.account.name;
                            req.session.email = response.account.username;
                            res.redirect(`${req.protocol}://${server.clienthost}/login?token=${req.session.token}`);
                        }
                    }
                });
        }).catch(err => {
            console.log("MicrosoftOAuthException: ", err);
        });
}

const generateToken = data => {
    // Secret is now stored in heroku config
    if (process.env.JWT_TOKEN_SECRET === "")
        process.env.JWT_TOKEN_SECRET = require('crypto').createHash('md5').update(JSON.stringify(process.env)).digest("hex");

    // Create a json webtoken to use for api calls
    return jwt.sign({userName : data[0].name, userEmail : data[0].email}, process.env.JWT_TOKEN_SECRET);
}

module.exports = {
    register,
    readData,
    updateData,
    deleteData,
    login,
    loginMicrosoft,
    authMicrosoft,
    userData,
    updateUser
};