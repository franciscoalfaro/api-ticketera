import mongoose from "mongoose";

const enterpriseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  image: {
    type: String,
    default: "default.png"
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const Enterprise = mongoose.model("Enterprise", enterpriseSchema);
export default Enterprise;
