import {
  IMessagerAccessRequest,
  IResponseAccessResponse,
} from "../../providers/message-broker-access/implementations/imessager-broker-acess.interface";
import { SendMailNewUserApplication } from "./send-mail-new-user.application";

export class SendMailNewUserController {
  constructor(
    private readonly sendMailNewUserApplication: SendMailNewUserApplication
  ) {}

  /**
   * Handle
   * @param req
   */
  async handle(req: IMessagerAccessRequest): Promise<IResponseAccessResponse> {
    try {
      await this.sendMailNewUserApplication.handle({
        email: req.body.email,
        name: req.body.name,
      });
      return {
        code: 201,
        response: {
          message: "E-mail enviado com sucesso!",
        },
      };
    } catch (error) {
      console.error("Erro ao enviar o e-mail:", error);
      return {
        code: 500,
        response: {
          message:
            "Erro interno ao enviar o e-mail. Tente novamente mais tarde.",
        },
      };
    }
  }
}
