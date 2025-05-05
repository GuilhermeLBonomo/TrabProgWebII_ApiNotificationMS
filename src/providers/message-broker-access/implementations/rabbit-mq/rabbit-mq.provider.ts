import dotenv from "dotenv";
import amqp from "amqplib";
import { v4 as uuidv4 } from "uuid";
import {
  IMessagerAccess,
  IMessagerAccessRequest,
  IMessagerBrokerAccess,
  IResponseAccessResponse,
} from "../imessager-broker-acess.interface";

dotenv.config();

export class RabbitMQ implements IMessagerBrokerAccess {
  private readonly URL: string =
    process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";

  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  private async getChannel(): Promise<amqp.Channel> {
    //SonarQube
    this.connection ??= await amqp.connect(this.URL);
    this.channel ??= await this.connection.createChannel();
    return this.channel;
  }

  async connect(): Promise<amqp.Channel> {
    return this.getChannel();
  }

  async createQueue(
    channel: amqp.Channel,
    queue: string
  ): Promise<amqp.Channel> {
    await channel.assertQueue(queue, { durable: true });
    return channel;
  }

  listenRPC(queue: string, callback: CallableFunction): void {
    this.getChannel()
      .then((channel) => this.createQueue(channel, queue))
      .then((ch) => {
        ch.consume(queue, async (msg) => {
          if (!msg) return;

          try {
            const request = this.messageConvertRequest(msg);
            const response = await callback(request);
            await this.responseCallRPC({
              queue,
              replyTo: msg.properties.replyTo,
              correlationId: msg.properties.correlationId,
              response,
            });
            ch.ack(msg);
          } catch (err) {
            console.error(`[listenRPC] Error on queue "${queue}":`, err);
            ch.nack(msg, false, false); // could change to true to requeue
          }
        });
      })
      .catch((err) =>
        console.error(`[listenRPC] Connection error for queue "${queue}":`, err)
      );
  }

  async sendPubSub(message: IMessagerAccess): Promise<void> {
    try {
      const channel = await this.getChannel().then((ch) =>
        this.createQueue(ch, message.queue)
      );
      channel.sendToQueue(
        message.queue,
        Buffer.from(JSON.stringify(message.message))
      );
    } catch (err) {
      console.error("[sendPubSub] Error sending message:", err);
    }
  }

  async sendRPC(message: IMessagerAccess): Promise<IResponseAccessResponse> {
    const timeout = Number(process.env.RABBITMQ_TIMEOUT) || 5000;
    const correlationId = uuidv4();
    const conn = await amqp.connect(this.URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(message.queue, { durable: true });
    const q = await ch.assertQueue("", { exclusive: true });

    return new Promise((resolve) => {
      let responded = false;

      const timer = setTimeout(() => {
        if (!responded) {
          conn.close();
          resolve({
            code: 408,
            response: { message: "Timeout" },
          });
        }
      }, timeout);

      ch.consume(
        q.queue,
        (msg) => {
          if (msg?.properties.correlationId === correlationId) {
            clearTimeout(timer);
            responded = true;
            conn.close();
            resolve(this.messageConvert(msg));
          } else {
            console.warn(
              "[sendRPC] Unexpected correlationId. Ignoring message."
            );
          }
        },
        { noAck: true }
      );

      ch.sendToQueue(
        message.queue,
        Buffer.from(JSON.stringify(message.message)),
        {
          correlationId,
          replyTo: q.queue,
        }
      );
    });
  }

  messageConvert(message: { content: Buffer }): IResponseAccessResponse {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        code: typeof parsed.code === "number" ? parsed.code : 200,
        response: parsed,
      };
    } catch (error) {
      return {
        code: 500,
        response: {
          message: "Invalid JSON format",
          raw: message.content.toString(),
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  messageConvertRequest(message: { content: Buffer }): IMessagerAccessRequest {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        body: parsed,
        message: "Parsed successfully",
      };
    } catch (error) {
      return {
        body: null,
        message: `Invalid JSON: ${message.content.toString()} (${
          error instanceof Error ? error.message : error
        })`,
      };
    }
  }

  async responseCallRPC(obj: {
    queue: string;
    replyTo: string;
    correlationId: string;
    response: IResponseAccessResponse;
  }): Promise<void> {
    try {
      const channel = await this.getChannel().then((ch) =>
        this.createQueue(ch, obj.queue)
      );
      channel.sendToQueue(
        obj.replyTo,
        Buffer.from(JSON.stringify(obj.response)),
        { correlationId: obj.correlationId }
      );
    } catch (err) {
      console.error("[responseCallRPC] Error sending response:", err);
    }
  }
}
