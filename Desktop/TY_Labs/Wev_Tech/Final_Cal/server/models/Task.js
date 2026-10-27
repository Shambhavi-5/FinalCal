
const mongoose = require("mongoose");
const taskSchemaOwnerPlaceholder = null;

const taskSchema = new mongoose.Schema(
  
  {
    
user: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: false,
  index: true,
},

    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    plannedDuration: {
      type: Number,
      required: true,
      min: 1,
    },
    energyLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Planned", "Done", "Partial", "Skipped"],
      default: "Planned",
    },
    actualDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualEnergy: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    plannedDate: {
      type: Date,
      default: Date.now,
    },
    planDecision: {
      type: String,
      enum: ["Today", "Tomorrow", "Let go"],
      default: "Today",
    },
    startSmallMinutes: {
      type: Number,
      default: null,
      min: 1,
      max: 15,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Task", taskSchema);
