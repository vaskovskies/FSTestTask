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
    await this.redisService.subscribe('service_events', (message) => {
      try {
        const payload = JSON.parse(message);
        const svc = payload.service || '';
        const act = payload.action || '';
        const lvl = payload.level || 'INFO';
        const body = payload.payload || '';
        const ts = payload.timestamp
          ? new Date(payload.timestamp)
          : new Date();

        this.logsRepository.insertLog({
          service: svc,
          action: act,
          payload: typeof body === 'string' ? body : JSON.stringify(body),
          level: lvl,
          timestamp: ts,
        }).then(() => {
          this.logger.log(`Log stored from PubSub: action=${act}, service=${svc}`);
        }).catch((err) => {
          this.logger.error(`Failed to insert log from PubSub: ${err.message}`);
        });
      } catch (err: any) {
        this.logger.error(`Failed to parse PubSub message: ${err.message}`);
      }
    });
  }

  async getLogs(filter: LogFilter) {
    return this.logsRepository.queryLogs(filter);
  }
}
