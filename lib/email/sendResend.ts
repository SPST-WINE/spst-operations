// FILE: lib/email/sendResend.ts
import { Resend } from "resend";

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_NOREPLY_FROM;
  if (!apiKey || !from) return null;
  return {
    resend: new Resend(apiKey),
    from,
  };
}

/**
 * Thin adapter over Resend.
 * Throws if missing config or if Resend returns error.
 */
export async function sendEmailResend(args: SendEmailArgs) {
  const client = getResendClient();
  if (!client) {
    throw new Error("Missing RESEND_API_KEY / RESEND_NOREPLY_FROM");
  }

  const toList = Array.isArray(args.to) ? args.to : [args.to];
  const to = toList
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);

  if (to.length === 0) {
    throw new Error("Missing recipient 'to'");
  }

  await client.resend.emails.send({
    from: client.from,
    to,
    subject: args.subject,
    html: args.html,
  });
}
