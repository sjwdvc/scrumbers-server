const { Schema, model } = require('mongoose');
const ACCOUNT_TYPE = {
    DEFAULT     : 0,
    MICROSOFT   : 1
}

const template = new Schema(
    {
        cards : Array,
        title : String
    }
)

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
        accountType : {
            type : Number,
            default: ACCOUNT_TYPE.DEFAULT
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
        lastPasswordReset: {
            type: Date,
            required: false,
        },
        templates : [template]
    },
    {timestamps : true},
);

module.exports = { 
    User: model('users', userSchema),
    ACCOUNT_TYPE
};