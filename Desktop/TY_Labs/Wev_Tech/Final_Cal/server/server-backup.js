require("node:dns/promises").setServers(["8.8.8.8", "1.1.1.1"]);
const taskRoutes = require("./routes/taskRoutes");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/tasks", taskRoutes);

// Test route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Guilt-Free Calendar backend is running!"
  });
});

// Connect to MongoDB, then start the server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();