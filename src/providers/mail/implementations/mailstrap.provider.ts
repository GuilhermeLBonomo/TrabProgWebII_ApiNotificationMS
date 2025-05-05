import { IMailAccess, IMessageMail } from "../imail-access.interface";
import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

require("dotenv").config();

export class MailTrap implements IMailAccess {
  private readonly transporter: Mail;

  /**
   * Constructor to initialize the transporter with configuration.
   */
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
   * Sends an email using the transporter.
   * @param mail The mail message to be sent, which includes the recipient, sender, subject, and body.
   * @throws Error if there is an issue with sending the email.
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
      console.log(`Email sent successfully to ${mail.to.email}`);
    } catch (error: any) {
      console.error(`Failed to send email to ${mail.to.email}`, error);
      throw new Error("Failed to send email");
    }
  }
}
