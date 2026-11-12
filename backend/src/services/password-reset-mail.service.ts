import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim();

  if (
    !host ||
    !user ||
    !pass ||
    !from ||
    ![465, 587].includes(port)
  ) {
    throw new Error("Password reset SMTP is not configured correctly.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user,
      pass,
    },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  return transporter;
}

export async function sendPasswordResetEmail(
  email: string,
  resetCode: string
): Promise<void> {
  const from = process.env.SMTP_FROM?.trim();

  if (!from) {
    throw new Error("SMTP_FROM is not configured.");
  }

  await getTransporter().sendMail({
    from: {
      name: "Prakash Pharmacy",
      address: from,
    },
    to: email,
    subject: "Prakash Pharmacy - Password Reset Code",
    text: [
      "Hello,",
      "",
      "A password reset was requested for your Prakash Pharmacy account.",
      "",
      `Your verification code is: ${resetCode}`,
      "",
      "This code expires in 15 minutes.",
      "",
      "If you did not request this reset, please ignore this email.",
      "",
      "Prakash Pharmacy",
    ].join("\n"),
  });
}
