import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, IsNotEmpty, Max, Min, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsNumber()
  @Min(1)
  @Max(65535)
  GRPC_PORT: number = 50051;

  @IsString()
  @IsNotEmpty({ message: 'MONGO_URI is required' })
  MONGO_URI: string;

  @IsString()
  @IsNotEmpty({ message: 'MONGO_DB_NAME is required' })
  MONGO_DB_NAME: string;

  @IsString()
  @IsNotEmpty({ message: 'REDIS_HOST is required' })
  REDIS_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsString()
  @IsNotEmpty()
  SERVICE_B_GRPC_HOST: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  SERVICE_B_GRPC_PORT: number = 50052;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formattedErrors = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`[Config Fail-Fast Validation Error]: ${formattedErrors}`);
  }

  return validatedConfig;
}
