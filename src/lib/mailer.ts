import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html: string };

let transport: Transporter | null = null;

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function smtpTransport(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

function sender(): string {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  return process.env.SMTP_USER ? `Our Places <${process.env.SMTP_USER}>` : "Our Places <no-reply@localhost>";
}

export function outboxDirectory(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MAIL_OUTBOX_DIR || path.join(process.cwd(), "storage", "outbox"));
}

/** Send through SMTP when it is set up; otherwise save the message as an .eml file in a local outbox to check by hand. */
export async function sendMail(mail: Mail): Promise<void> {
  const message = { from: sender(), ...mail };
  if (mailConfigured()) {
    await smtpTransport().sendMail(message);
    return;
  }
  const { message: raw } = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(message);
  const directory = outboxDirectory();
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.eml`);
  await writeFile(file, raw as Buffer);
  console.info(`Email not sent because SMTP is not set up; saved to ${file}`);
}
