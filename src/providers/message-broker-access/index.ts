import { IRouterMessageBroker } from "./implementations/imessager-broker-acess.interface";
import { RabbitMQ } from "./implementations/rabbit-mq/rabbit-mq.provider";
import { SendMailNewUserQueue } from "./implementations/router/send-mail-new-user-queue.router";

const listQueuesListen: Array<IRouterMessageBroker> = [
  new SendMailNewUserQueue(),
];

const app = {
  listen: (callback: CallableFunction) => {
    const messagerBrokerAccess = new RabbitMQ();
    listQueuesListen.forEach((queueListen) => {
      queueListen.handle(messagerBrokerAccess);
    });
    callback();
  },
};

export { app };
