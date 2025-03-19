const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    githubId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    displayName: String,
    email: String,
    avatarUrl: String,
    mergedPRs: [{
        repoId: String,
        prNumber: Number,
        title: String,
        mergedAt: Date
    }],
    cancelledPRs: [{
        repoId: String,
        prNumber: Number,
        title: String,
        cancelledAt: Date
    }],
    points: {
        type: Number,
        default: 0
    },
    badges: {
        type: [String],
        default: ['Newcomer']
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
