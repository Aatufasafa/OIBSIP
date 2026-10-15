const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransport } = require("../utils/mailer");

test("mail delivery can use the configured SMTP account as its sender", () => {
  const original = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_FROM: process.env.SMTP_FROM,
  };

  try {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_USER = "sender@example.test";
    delete process.env.SMTP_FROM;

    const { from, transport } = createTransport();
    assert.equal(from, "sender@example.test");
    transport.close();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("mail delivery still requires a sender when SMTP_USER is absent", () => {
  const original = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_FROM: process.env.SMTP_FROM,
  };

  try {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_FROM;

    assert.throws(createTransport, /SMTP_FROM or SMTP_USER/);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
