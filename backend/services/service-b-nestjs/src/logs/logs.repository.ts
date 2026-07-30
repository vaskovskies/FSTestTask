import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';
import { Collection, Filter, ObjectId } from 'mongodb';

export interface LogDocument {
  _id?: ObjectId;
  service: string;
  action: string;
  payload: string;
  level: string;
  timestamp: Date;
}

export interface LogFilter {
  service?: string;
  action?: string;
  level?: string;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface LogEntry {
  id: string;
  service: string;
  action: string;
  payload: string;
  level: string;
  timestamp: number;
}

@Injectable()
export class LogsRepository {
  private readonly logger = new Logger(LogsRepository.name);

  constructor(private readonly mongoService: MongoService) {}

  private getCollection(): Collection<LogDocument> {
    return this.mongoService.getDb().collection<LogDocument>('logs');
  }

  async insertLog(doc: LogDocument): Promise<void> {
    const collection = this.getCollection();
    await collection.insertOne(doc);
  }

  async queryLogs(
    filter: LogFilter,
  ): Promise<{ data: LogEntry[]; total: number }> {
    const collection = this.getCollection();
    const bsonFilter: Filter<LogDocument> = {};

    if (filter.service) bsonFilter.service = filter.service;
    if (filter.action) bsonFilter.action = filter.action;
    if (filter.level) bsonFilter.level = filter.level;

    if (filter.startDate || filter.endDate) {
      const dateFilter: any = {};
      if (filter.startDate) dateFilter.$gte = filter.startDate;
      if (filter.endDate) dateFilter.$lte = filter.endDate;
      bsonFilter.timestamp = dateFilter;
    }

    const total = await collection.countDocuments(bsonFilter);

    const page = filter.page < 1 ? 1 : filter.page;
    const limit = filter.limit < 1 ? 10 : filter.limit;
    const skip = (page - 1) * limit;

    const cursor = collection
      .find(bsonFilter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const docs = await cursor.toArray();

    const data: LogEntry[] = docs.map((doc) => ({
      id: doc._id.toHexString(),
      service: doc.service,
      action: doc.action,
      payload: doc.payload,
      level: doc.level,
      timestamp: doc.timestamp.getTime(),
    }));

    return { data, total };
  }
}
