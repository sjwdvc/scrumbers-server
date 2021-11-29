const { Schema, model } = require('mongoose');
const ObjectId = require('mongoose').Types.ObjectId;

const vote = new Schema(
    {
        round : Number,
        user : ObjectId,
        value : Number,
        sender: String
    }
);

const message = new Schema(
    {
        round : Number,
        user : ObjectId,
        value : String,
        sender: String
    }
);

const feature = new Schema(
    {
        title : String,
        votes : [vote],
        chat: [message]
    }
);

const player = new Schema(
    {
        id : ObjectId,
        email : String
    }
)

const sessionSchema = new Schema(
    {
        admin : {
            type : ObjectId,
            required : [true, 'admin field is required'],
        },
        features : [feature],
        players : [player]
    },
    {timestamps : true}
);

module.exports = model('sessions', sessionSchema);
