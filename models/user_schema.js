const { Schema, model} = require('mongoose');

const userSchema = new Schema(
    {
        name : {
            type : String,
            required : [true, 'name field is required'],
        },
        email : {
            type : String,
            required : [true, 'email field is required'],
        },
        password : {
            type : String,
            required : [true, 'password field is required'],
        },
        age : {
            type : String,
            required : false,
        },
        function : {
            type : String,
            required : false,
        },
    },
    {timestamps : true},
);

module.exports = model('users', userSchema);
