import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5174",
  groqApiKey: requireEnv("GROQ_API_KEY"),
  groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
  // All optional - when smtpHost is unset, email.service.ts falls back to an
  // auto-created Ethereal test inbox (no real credentials needed) instead of
  // failing outright, so "Email Invoice" works out of the box in dev/demo.
  // Set these to a real provider (Gmail app password, SendGrid, etc.) to
  // actually deliver to real inboxes.
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM ?? "DealFlow360 <billing@dealflow360.demo>",
};
