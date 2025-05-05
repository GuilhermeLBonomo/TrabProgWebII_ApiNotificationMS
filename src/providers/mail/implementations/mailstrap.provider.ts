import { IMailAccess, IMessageMail } from "../imail-access.interface";
import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

require("dotenv").config();

export class MailTrap implements IMailAccess {
  private readonly transporter: Mail;

  constructor() {
    const requiredEnv = [
      "MAILTRAP_HOST",
      "MAILTRAP_PORT",
      "MAILTRAP_USER",
      "MAILTRAP_PASSWORD",
    ];
    const missing = requiredEnv.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }

    const transportOptions: SMTPTransport.Options = {
      host: process.env.MAILTRAP_HOST!,
      port: Number(process.env.MAILTRAP_PORT!),
      auth: {
        user: process.env.MAILTRAP_USER!,
        pass: process.env.MAILTRAP_PASSWORD,
      },
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    };

    this.transporter = nodemailer.createTransport(transportOptions);
  }

  /**
   * Sends an email using the transporter.
   * @param mail The mail message to be sent.
   */
  async send(mail: IMessageMail): Promise<void> {
    try {
      await this.transporter.sendMail({
        to: {
          name: mail.to.name,
          address: mail.to.email,
        },
        from: {
          name: mail.from.name,
          address: mail.from.email,
        },
        subject: mail.subject,
        html: mail.body,
      });
      console.log(`Email enviado para ${mail.to.email}`);
    } catch (error: any) {
      console.error(`Erro ao enviar email para ${mail.to.email}`, error);
      throw new Error("Failed to send email");
    }
  }
}
