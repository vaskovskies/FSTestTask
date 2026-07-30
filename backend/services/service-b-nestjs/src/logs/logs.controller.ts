import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';

@ApiTags('Logs')
@Controller('api/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Query logs with optional filtering by service, action, level, and date range, with pagination' })
  async getLogs(@Query() dto: QueryLogsDto) {
    const startDate = dto.start_date ? new Date(dto.start_date) : undefined;
    const endDate = dto.end_date ? new Date(dto.end_date) : undefined;

    const { data, total } = await this.logsService.getLogs({
      service: dto.service,
      action: dto.action,
      level: dto.level,
      startDate,
      endDate,
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
    });

    return {
      logs: data,
      total,
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
    };
  }
}
