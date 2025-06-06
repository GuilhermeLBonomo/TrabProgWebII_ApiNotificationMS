import dotenv from "dotenv";
import amqp, { Channel, Connection, ConsumeMessage } from "amqplib";
import { v4 as uuidv4 } from "uuid";
import {
  IMessagerAccess,
  IMessagerAccessRequest,
  IMessagerBrokerAccess,
  IResponseAccessResponse,
} from "../imessager-broker-acess.interface";

dotenv.config();

export class RabbitMQ implements IMessagerBrokerAccess {
  private readonly URL: string;

  constructor() {
    const user = process.env.RABBIT_USER;
    const pass = process.env.RABBIT_PASSWORD;
    const host = process.env.RABBIT_HOST;
    const port = process.env.RABBIT_PORT;

    if (!user || !pass || !host || !port) {
      throw new Error(
        "Missing RabbitMQ environment variables. Check RABBIT_USER, RABBIT_PASSWORD, RABBIT_HOST, RABBIT_PORT."
      );
    }

    this.URL = `amqp://${user}:${pass}@${host}:${port}`;
  }

  async connect(): Promise<Channel> {
    try {
      const conn: Connection = await amqp.connect(this.URL);
      return await conn.createChannel();
    } catch (err) {
      console.error("Failed to connect to RabbitMQ:", err);
      throw err;
    }
  }

  async createQueue(channel: Channel, queue: string): Promise<Channel> {
    try {
      await channel.assertQueue(queue, { durable: true });
      return channel;
    } catch (err) {
      console.error(`Error asserting queue [${queue}]:`, err);
      throw err;
    }
  }

  async sendPubSub(message: IMessagerAccess): Promise<void> {
    try {
      const channel = await this.connect().then((ch) =>
        this.createQueue(ch, message.queue)
      );
      channel.sendToQueue(
        message.queue,
        Buffer.from(JSON.stringify(message.message))
      );
    } catch (err) {
      console.error("Error in sendPubSub:", err);
    }
  }

  listenRPC(queue: string, callback: CallableFunction): void {
    this.connect()
      .then((channel) => this.createQueue(channel, queue))
      .then((ch) => {
        ch.consume(queue, async (msg: ConsumeMessage | null) => {
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
            console.error("Error handling RPC message:", err);
            ch.nack(msg, false, false);
          }
        });
      })
      .catch((err) => console.error("Failed to initialize RPC listener:", err));
  }

  async sendRPC(message: IMessagerAccess): Promise<IResponseAccessResponse> {
    const timeout = Number(process.env.RABBIT_TIMEOUT) || 5000;
    const correlationId = uuidv4();

    try {
      const conn = await amqp.connect(this.URL);
      const ch = await conn.createChannel();
      await ch.assertQueue(message.queue, { durable: true });
      const q = await ch.assertQueue("", { exclusive: true });

      return new Promise((resolve) => {
        let isResponded = false;

        const timer = setTimeout(() => {
          if (!isResponded) {
            conn.close();
            resolve({
              code: 408,
              response: { message: "RPC response timeout" },
            });
          }
        }, timeout);

        ch.consume(
          q.queue,
          (msg) => {
            if (msg?.properties.correlationId === correlationId) {
              clearTimeout(timer);
              conn.close();
              isResponded = true;
              resolve(this.messageConvert(msg));
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
    } catch (err) {
      console.error("Error in sendRPC:", err);
      return this.createErrorResponse("Failed to send RPC message", err);
    }
  }

  async responseCallRPC(objResponse: {
    queue: string;
    replyTo: string;
    correlationId: string;
    response: IResponseAccessResponse;
  }): Promise<void> {
    try {
      const channel = await this.connect().then((ch) =>
        this.createQueue(ch, objResponse.queue)
      );
      channel.sendToQueue(
        objResponse.replyTo,
        Buffer.from(JSON.stringify(objResponse.response)),
        { correlationId: objResponse.correlationId }
      );
    } catch (err) {
      console.error("Error in responseCallRPC:", err);
    }
  }

  messageConvert(message: { content: Buffer }): IResponseAccessResponse {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        code: typeof parsed.code === "number" ? parsed.code : 200,
        response: parsed,
      };
    } catch (error) {
      return this.createErrorResponse("Invalid JSON in message content", error);
    }
  }

  messageConvertRequest(message: { content: Buffer }): IMessagerAccessRequest {
    try {
      const parsed = JSON.parse(message.content.toString());
      return {
        body: parsed,
        message: "Successfully parsed",
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown parsing error";
      return {
        body: null,
        message: `Invalid JSON (${errorMsg}): ${message.content.toString()}`,
      };
    }
  }

  private createErrorResponse(
    message: string,
    error: any
  ): IResponseAccessResponse {
    return {
      code: 500,
      response: {
        message,
        error: error instanceof Error ? error.stack : String(error),
      },
    };
  }
}
