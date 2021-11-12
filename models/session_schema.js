const { Schema, model } = require('mongoose');
const ObjectId = require('mongoose').Types.ObjectId;

const vote = new Schema(
    {
        user : ObjectId,
        value : Number,
        sender: String
    }
);

const message = new Schema(
    {
        user : ObjectId,
        value : String,
        sender: String
    }
);

const feature = new Schema(
    {
        votes : [vote],
        chat: [message]
    }
);

const sessionSchema = new Schema(
    {
        admin : {
            type : ObjectId,
            required : [true, 'admin field is required'],
        },
        features : [feature],
    },
    {timestamps : true}
);

module.exports = model('sessions', sessionSchema);
