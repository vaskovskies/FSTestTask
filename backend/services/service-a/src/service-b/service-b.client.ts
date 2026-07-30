import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { credentials } from '@grpc/grpc-js';
import { AppConfigService } from '../config/app-config.service';
import {
  LogServiceClient as LogServiceClientType,
  GenerateReportRequest,
  GenerateReportResponse,
} from './generated/logs';
import { LogServiceClient } from './generated/logs';

@Injectable()
export class ServiceBClient implements OnModuleInit {
  private readonly logger = new Logger(ServiceBClient.name);
  private client: LogServiceClientType;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit() {
    const address = `${this.config.serviceBGrpcHost}:${this.config.serviceBGrpcPort}`;
    this.logger.log(`Connecting to Service B gRPC at ${address}`);
    this.client = new LogServiceClient(address, credentials.createInsecure());
  }

  async generateReport(
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<{ pdfContent: Buffer; filename: string }> {
    return new Promise((resolve, reject) => {
      this.client.generateReport(
        { startTimestamp, endTimestamp } as GenerateReportRequest,
        (error, response: GenerateReportResponse) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({
            pdfContent: Buffer.from(response.pdfContent),
            filename: response.filename,
          });
        },
      );
    });
  }
}
