import { IMailAccess, IMessageMail } from "../imail-access.interface";
import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

require("dotenv").config();

export class MailTrap implements IMailAccess {
  private readonly transporter: Mail;

  constructor() {
    const transportOptions: SMTPTransport.Options = {
      host: process.env.MAILTRAP_HOST,
      port: Number(process.env.MAILTRAP_PORT),
      auth: {
        user: process.env.MAILTRAP_USER!,
        pass: process.env.MAILTRAP_PASS!,
      },
    };

    this.transporter = nodemailer.createTransport(transportOptions);
  }

  /**
   * Send Mail
   * @param mail
   */
  async send(mail: IMessageMail): Promise<void> {
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
  }
}
