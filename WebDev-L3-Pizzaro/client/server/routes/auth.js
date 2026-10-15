const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/mailer");

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL = 15 * 60 * 1000;
const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function issueVerificationEmail(user) {
  const token = createToken();
  user.emailVerificationToken = hashToken(token);
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL);
  await user.save();
  await sendVerificationEmail(user, token);
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.trim().length > 100 ||
      typeof email !== "string" ||
      !EMAIL_PATTERN.test(email.trim()) ||
      email.length > 254 ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Enter a valid name and email, and a password of 8–128 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
    });

    try {
      await issueVerificationEmail(user);
    } catch (error) {
      console.error("Verification email delivery failed:", error.message);
      return res.status(503).json({
        message:
          "Your account was created, but the verification email could not be sent. Configure email delivery and request a new link.",
        code: "VERIFICATION_EMAIL_FAILED",
      });
    }

    res.status(201).json({
      message: "Account created. Check your email to verify your account.",
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }
    res.status(500).json({ message: "Server error while creating account" });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ message: "A valid verification token is required" });
    }

    const user = await User.findOneAndUpdate(
      {
        emailVerificationToken: hashToken(token),
        emailVerificationExpires: { $gt: new Date() },
        isEmailVerified: false,
      },
      {
        $set: { isEmailVerified: true },
        $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 },
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        message: "Verification link is invalid, expired, or already used",
      });
    }

    res.json({ message: "Email verified. You can now sign in." });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Unable to verify email" });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !EMAIL_PATTERN.test(email.trim())
    ) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const message =
      "If the account exists and still needs verification, a new link will be sent.";

    if (!user || user.isEmailVerified) {
      return res.json({ message });
    }

    await issueVerificationEmail(user);
    res.json({ message });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(503).json({ message: "Unable to send a verification email right now" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !EMAIL_PATTERN.test(email.trim()) ||
      typeof password !== "string" ||
      !password ||
      password.length > 128
    ) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before signing in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error while logging in" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !EMAIL_PATTERN.test(email.trim())
    ) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const message =
      "If an account exists with this email, reset instructions will be sent.";
    if (!user) return res.json({ message });

    const token = createToken();
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL);
    await user.save();
    try {
      await sendPasswordResetEmail(user, token);
    } catch (error) {
      console.error("Password reset email delivery failed:", error.message);
      try {
        await User.updateOne(
          { _id: user._id, resetPasswordToken: user.resetPasswordToken },
          { $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } }
        );
      } catch (cleanupError) {
        console.error(
          "Unable to clear undelivered password reset token:",
          cleanupError.message
        );
      }
      return res.status(503).json({
        message:
          "Password reset email could not be delivered. Check the SMTP server certificate settings (SMTP_CA_FILE) and try again.",
        code: "EMAIL_DELIVERY_FAILED",
      });
    }

    res.json({ message });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Unable to process password reset" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "A valid reset link and a password of 8–128 characters are required",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: hashToken(token),
        resetPasswordExpires: { $gt: new Date() },
      },
      {
        $set: {
          password: await bcrypt.hash(password, 12),
          isEmailVerified: true,
        },
        $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid, expired, or already used" });
    }

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Unable to reset password" });
  }
});

module.exports = router;
