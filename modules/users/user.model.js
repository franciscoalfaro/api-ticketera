import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  microsoftId: {
    type: String,
    default: '',
    required: false,
    unique: true,
    sparse: true
  },
  password: {
    type: String
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "List.items", // referencia al item dentro de una lista (roles)
    default: null
  },
  type: {
    type: String,
    enum: ['local', 'microsoft'],
    default: 'local'
  },
  area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Area",
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
});

const User = mongoose.model("User", userSchema);
export default User;
