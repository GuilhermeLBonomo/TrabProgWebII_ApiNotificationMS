import { sendMailNewUserController } from "../../../../app/send-mail-new-user";
import {
  IRouterMessageBroker,
  IMessagerBrokerAccess,
  IMessagerAccessRequest,
} from "../imessager-broker-acess.interface";

export class SendMailNewUserQueue implements IRouterMessageBroker {
  /**
   * Handle queue consumption
   * @param messagerBroker
   */
  handle(messagerBroker: IMessagerBrokerAccess) {
    messagerBroker.listenRPC(
      "send-email-new-user",
      async (data: IMessagerAccessRequest) => {
        try {
          return await sendMailNewUserController.handle(data);
        } catch (error) {
          console.error("Erro ao enviar e-mail:", error);
          return {
            code: 500,
            response: {
              message: "Erro ao enviar e-mail.",
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }
    );
  }
}
