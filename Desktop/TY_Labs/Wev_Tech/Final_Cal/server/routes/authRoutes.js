
const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
}

// Check whether the current session has a logged-in user.
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "You are not logged in.",
    });
  }

  res.json({
    user: {
      id: req.session.userId,
      name: req.session.userName,
      email: req.session.userEmail,
    },
  });
});

// Register a new account.
router.post("/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (!name || name.length > 60) {
      return res.status(400).json({
        message: "Enter a name between 1 and 60 characters.",
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Your password must be at least 12 characters and no more than 72 UTF-8 bytes.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    req.session.userId = user._id.toString();
    req.session.userName = user.name;
    req.session.userEmail = user.email;

    req.session.save((error) => {
      if (error) {
        return res.status(500).json({
          message: "Account created, but the session could not be saved. Please log in.",
        });
      }

      res.status(201).json({
        message: "Account created successfully.",
        user: publicUser(user),
      });
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Signup error:", error.message);

    res.status(500).json({
      message: "Could not create your account.",
    });
  }
});

// Log in to an existing account.
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (!email || typeof password !== "string") {
      return res.status(400).json({
        message: "Enter your email and password.",
      });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Incorrect email or password.",
      });
    }

    // Regenerate the session to prevent session fixation.
    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          message: "Could not start your session.",
        });
      }

      req.session.userId = user._id.toString();
      req.session.userName = user.name;
      req.session.userEmail = user.email;

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            message: "Could not save your session.",
          });
        }

        res.json({
          message: "Welcome back.",
          user: publicUser(user),
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Could not log in.",
    });
  }
});

// Log out and destroy the server-side session.
router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.sendStatus(204);
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        message: "Could not log out.",
      });
    }

    res.clearCookie("ebb.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    res.sendStatus(204);
  });
});

module.exports = router;
