import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let transporterPromise: Promise<Transporter> | null = null;
// True only when the cached transporter is the Ethereal fallback - lets
// sendInvoiceEmail decide whether a preview link is meaningful to return.
let usingEtherealFallback = false;

/**
 * Lazily creates (and caches) one shared transporter for the app's lifetime.
 * Real SMTP is used the moment SMTP_HOST is configured; otherwise this
 * auto-provisions a free, credential-less Ethereal (nodemailer's disposable
 * test-SMTP service) account so "Email Invoice" is fully functional in
 * dev/demo without anyone needing to supply real mailbox credentials - every
 * send returns a preview URL instead of landing in a real inbox.
 */
function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.smtpHost) {
      usingEtherealFallback = false;
      return nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: env.smtpUser && env.smtpPassword ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
      });
    }

    usingEtherealFallback = true;
    const testAccount = await nodemailer.createTestAccount();
    // eslint-disable-next-line no-console
    console.log(
      `[email.service] No SMTP_HOST configured - using an Ethereal test inbox (${testAccount.user}). ` +
        "Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD in .env to send to real inboxes instead."
    );
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  })();

  return transporterPromise;
}

export interface SendInvoiceEmailInput {
  to: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  dueDate: Date;
  status: string;
  pdfBuffer: Buffer;
}

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

/**
 * Sends the invoice PDF as an attachment. Returns a previewUrl only when the
 * Ethereal fallback handled the send - the caller surfaces that so Finance
 * can actually see what was "sent" without a real inbox to check.
 */
export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<{ previewUrl: string | null }> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: env.smtpFrom,
    to: input.to,
    subject: `Invoice ${input.invoiceNumber} from DealFlow360`,
    text:
      `Hi ${input.customerName},\n\n` +
      `Please find attached invoice ${input.invoiceNumber} for ${formatCurrency(input.amount)}, ` +
      `due ${input.dueDate.toLocaleDateString()}.\n\n` +
      `Status: ${input.status}\n\n` +
      "Thank you for your business.\nDealFlow360 Billing",
    attachments: [
      {
        filename: `${input.invoiceNumber}.pdf`,
        content: input.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { previewUrl: usingEtherealFallback ? nodemailer.getTestMessageUrl(info) || null : null };
}
