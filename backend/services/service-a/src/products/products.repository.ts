import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';
import { Collection, Filter } from 'mongodb';

export interface ProductDocument {
  _id?: any;
  externalId: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage?: number;
  rating?: number;
  stock?: number;
  tags?: string[];
  brand?: string;
  sku?: string;
  images?: string[];
  thumbnail?: string;
  importedAt: Date;
}

@Injectable()
export class ProductsRepository {
  private readonly logger = new Logger(ProductsRepository.name);

  constructor(private readonly mongoService: MongoService) {}

  private getCollection(): Collection<ProductDocument> {
    return this.mongoService.getDb().collection<ProductDocument>('products');
  }

  async upsertProducts(products: ProductDocument[]): Promise<{ upsertedCount: number; modifiedCount: number }> {
    const collection = this.getCollection();
    const operations = products.map((product) => ({
      updateOne: {
        filter: { externalId: product.externalId },
        update: { $set: { ...product, importedAt: new Date() } },
        upsert: true,
      },
    }));

    if (operations.length === 0) {
      return { upsertedCount: 0, modifiedCount: 0 };
    }

    const result = await collection.bulkWrite(operations, { ordered: false });
    return {
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  async searchProducts(
    query?: string,
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    page = 1,
    limit = 10,
  ): Promise<{ data: ProductDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const collection = this.getCollection();
    const filter: Filter<ProductDocument> = {};

    if (query && query.trim().length > 0) {
      filter.$text = { $search: query.trim() };
    }

    if (category) {
      filter.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;
    const total = await collection.countDocuments(filter);

    const cursor = collection.find(filter);
    if (query && query.trim().length > 0) {
      cursor.project({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
    } else {
      cursor.sort({ externalId: 1 });
    }

    const data = await cursor.skip(skip).limit(limit).toArray();
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
