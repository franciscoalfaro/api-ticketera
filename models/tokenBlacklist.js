import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const tokenBlacklistSchema = new Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // El token se eliminará automáticamente después de 30 días
    }
});

const TokenBlacklist = model('TokenBlacklist', tokenBlacklistSchema);

export default TokenBlacklist;
