const nodemailer = require("nodemailer");
const fs = require("fs");
const tls = require("tls");

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } =
    process.env;

  const from = process.env.SMTP_FROM || SMTP_USER;
  if (!SMTP_HOST || !SMTP_PORT || !from) {
    throw new Error(
      "Email delivery requires SMTP_HOST, SMTP_PORT, and SMTP_FROM or SMTP_USER"
    );
  }

  const ca = process.env.SMTP_CA_FILE
    ? [
        ...tls.rootCertificates,
        fs.readFileSync(process.env.SMTP_CA_FILE),
      ]
    : undefined;

  return {
    from,
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === "true",
      auth:
        SMTP_USER && SMTP_PASS
          ? { user: SMTP_USER, pass: SMTP_PASS }
          : undefined,
      tls: {
        ...(ca ? { ca } : {}),
        ...(process.env.SMTP_TLS_SERVERNAME
          ? { servername: process.env.SMTP_TLS_SERVERNAME }
          : {}),
      },
    }),
  };
}

function isLowStockEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      (process.env.SMTP_FROM || process.env.SMTP_USER) &&
      process.env.ADMIN_ALERT_EMAIL
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function sendLinkEmail({ to, subject, heading, message, link, action }) {
  const { from, transport } = createTransport();
  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  const safeLink = escapeHtml(link);
  const safeAction = escapeHtml(action);

  await transport.sendMail({
    from,
    to,
    subject,
    text: `${heading}\n\n${message}\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222"><h1>${safeHeading}</h1><p>${safeMessage}</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#bd1010;color:#fff;text-decoration:none;border-radius:6px">${safeAction}</a></p><p>If you did not request this, you can ignore this email.</p></main>`,
  });
}

function getClientUrl() {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")[0]
    .trim();
  return clientUrl.replace(/\/+$/, "");
}

async function sendVerificationEmail(user, token) {
  const link = `${getClientUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendLinkEmail({
    to: user.email,
    subject: "Verify your PIZZARO email",
    heading: `Welcome to PIZZARO, ${user.name}`,
    message: "Verify your email address to activate your account. This link expires in 24 hours.",
    link,
    action: "Verify email",
  });
}

async function sendPasswordResetEmail(user, token) {
  const link = `${getClientUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendLinkEmail({
    to: user.email,
    subject: "Reset your PIZZARO password",
    heading: "Reset your password",
    message: "Use this one-time link within 15 minutes to choose a new password.",
    link,
    action: "Reset password",
  });
}

async function sendLowStockEmail(ingredient) {
  if (!process.env.ADMIN_ALERT_EMAIL) {
    throw new Error("ADMIN_ALERT_EMAIL is not configured");
  }

  const { from, transport } = createTransport();
  const text = `${ingredient.name} stock is low: ${ingredient.stock} remaining (alert threshold: ${ingredient.lowStockThreshold}).`;
  await transport.sendMail({
    from,
    to: process.env.ADMIN_ALERT_EMAIL,
    subject: `PIZZARO low stock: ${ingredient.name}`,
    text,
    html: `<p>${escapeHtml(text)}</p>`,
  });
}

module.exports = {
  createTransport,
  isLowStockEmailConfigured,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLowStockEmail,
};
