const mongoose = require('mongoose');

const repoSchema = new mongoose.Schema({
    repoLink: {
        type: String,
        required: true,
        unique: true
    },
    ownerName: {
        type: String,
        required: true
    },
    technology: {
        type: [String],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    reviewStatus: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    reviewedBy: {
        type: String,
        default: null
    },
    successPoints: {
        type: Number,
        default: 50
    }
});

module.exports = mongoose.model('Repo', repoSchema);
