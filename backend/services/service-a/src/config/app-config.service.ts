import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import appConfig, { AppConfig } from './app.config';

@Injectable()
export class AppConfigService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  get get(): AppConfig {
    return this.config;
  }

  get port(): number {
    return this.config.port;
  }

  get grpcPort(): number {
    return this.config.grpcPort;
  }

  get mongoUri(): string {
    return this.config.mongoUri;
  }

  get mongoDbName(): string {
    return this.config.mongoDbName;
  }

  get redisHost(): string {
    return this.config.redisHost;
  }

  get redisPort(): number {
    return this.config.redisPort;
  }

  get serviceBGrpcHost(): string {
    return this.config.serviceBGrpcHost;
  }

  get serviceBGrpcPort(): number {
    return this.config.serviceBGrpcPort;
  }
}
