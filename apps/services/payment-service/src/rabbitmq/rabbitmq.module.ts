import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentEventsPublisher } from './payment-events.publisher';
import { PAYMENTS_CLIENT, PAYMENTS_QUEUE } from './rabbitmq.constants';

@Module({})
export class RabbitmqModule {
  static forRoot(): DynamicModule {
    return {
      module: RabbitmqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: PAYMENTS_CLIENT,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              transport: Transport.RMQ,
              options: {
                urls: [
                  config.get<string>('RABBITMQ_URL') ??
                    'amqp://guest:guest@localhost:5672',
                ],
                queue: PAYMENTS_QUEUE,
                queueOptions: { durable: true },
              },
            }),
          },
        ]),
      ],
      providers: [PaymentEventsPublisher],
      exports: [PaymentEventsPublisher],
    };
  }
}
