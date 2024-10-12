// models/image.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const imageSchema = new Schema({
    chatId: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true
    }
});

const Image = mongoose.model('Image', imageSchema);
module.exports = Image;
