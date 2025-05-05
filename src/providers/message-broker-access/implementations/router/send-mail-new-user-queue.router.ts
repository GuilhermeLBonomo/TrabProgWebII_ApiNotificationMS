import dotenv from "dotenv";
import { sendMailNewUserController } from "../../../../app/send-mail-new-user";
import {
  IRouterMessageBroker,
  IMessagerBrokerAccess,
  IMessagerAccessRequest,
} from "../imessager-broker-acess.interface";

dotenv.config();

export class SendMailNewUserQueue implements IRouterMessageBroker {
  /**
   * Handle queue consumption
   * @param messagerBroker
   */
  handle(messagerBroker: IMessagerBrokerAccess) {
    const queueName = process.env.RABBIT_QUEUE;

    if (!queueName) {
      throw new Error("Missing required environment variable: RABBIT_QUEUE");
    }

    messagerBroker.listenRPC(
      queueName,
      async (data: IMessagerAccessRequest) => {
        try {
          return await sendMailNewUserController.handle(data);
        } catch (error: any) {
          console.error("[handle] Failed to send e-mail:", error);
          return {
            code: 500,
            response: {
              message: "Error while sending e-mail.",
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }
    );
  }
}
