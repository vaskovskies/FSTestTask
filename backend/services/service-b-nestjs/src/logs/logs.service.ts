import { Injectable, Logger } from '@nestjs/common';
import { LogsRepository, LogFilter } from './logs.repository';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    private readonly logsRepository: LogsRepository,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    this.redisService.subscribeToStream(
      'service_events',
      'service-b-nestjs-group',
      'service-b-nestjs-1',
      async (fields) => {
        const svc = fields.service || '';
        const act = fields.action || '';
        const lvl = fields.level || 'INFO';
        const body = fields.payload || '';
        const ts = fields.timestamp
          ? new Date(Number(fields.timestamp))
          : new Date();

        await this.logsRepository.insertLog({
          service: svc,
          action: act,
          payload: typeof body === 'string' ? body : JSON.stringify(body),
          level: lvl,
          timestamp: ts,
        });

        this.logger.log(`Log stored from stream: action=${act}, service=${svc}`);
      },
    );
  }

  async getLogs(filter: LogFilter) {
    return this.logsRepository.queryLogs(filter);
  }
}
