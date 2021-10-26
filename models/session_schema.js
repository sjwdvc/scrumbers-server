const { Schema, model } = require('mongoose');

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
const feature = new Schema(
    {
        votes : [vote],
        chat: [message]
    }
);
const vote = new Schema(
    {
        user : ObjectId,
        value : Number
    }
);
const message = new Schema(
    {
        user : ObjectId,
        value : String
    }
);

module.exports = model('sessions', sessionSchema);
