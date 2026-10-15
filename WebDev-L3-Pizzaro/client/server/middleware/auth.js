const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  if (!decoded || typeof decoded !== "object" || !decoded.userId) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await User.findById(decoded.userId).select(
      "_id name email role isEmailVerified"
    );
    if (!user || !user.isEmailVerified) {
      return res.status(401).json({
        message: "A verified account is required",
      });
    }

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (error) {
    console.error("Authentication lookup failed:", error);
    return res.status(500).json({ message: "Unable to verify account access" });
  }
}

module.exports = protect;