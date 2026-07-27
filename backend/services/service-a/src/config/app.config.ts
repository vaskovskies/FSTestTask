import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  grpcPort: number;
  mongoUri: string;
  mongoDbName: string;
  redisHost: string;
  redisPort: number;
  serviceBGrpcHost: string;
  serviceBGrpcPort: number;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    grpcPort: parseInt(process.env.GRPC_PORT || '50051', 10),
    mongoUri: process.env.MONGO_URI || '',
    mongoDbName: process.env.MONGO_DB_NAME || '',
    redisHost: process.env.REDIS_HOST || '',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    serviceBGrpcHost: process.env.SERVICE_B_GRPC_HOST || 'localhost',
    serviceBGrpcPort: parseInt(process.env.SERVICE_B_GRPC_PORT || '50052', 10),
  }),
);
