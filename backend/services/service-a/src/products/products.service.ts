import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ProductsRepository, ProductDocument } from './products.repository';
import { RedisTimeSeriesService } from '../redis/redis-timeseries.service';
import { SearchProductDto } from './dto/search-product.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly redisTimeSeriesService: RedisTimeSeriesService,
  ) {}

  /**
   * Bonus 1: Fetch large dataset from dummyjson.com and return as downloadable buffer (JSON or Excel)
   */
  async fetchAndGenerateData(format: 'json' | 'excel' = 'json'): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const startTime = Date.now();
    this.logger.log(`Fetching product data from dummyjson.com API...`);

    const response = await fetch('https://dummyjson.com/products?limit=200');
    if (!response.ok) {
      throw new Error(`Failed to fetch from dummyjson API: ${response.statusText}`);
    }

    const data: any = await response.json();
    const products = data.products || [];

    const fileName = `products_export_${Date.now()}.${format === 'excel' ? 'xlsx' : 'json'}`;

    let buffer: Buffer;
    let mimeType: string;

    if (format === 'json') {
      buffer = Buffer.from(JSON.stringify(products, null, 2), 'utf-8');
      mimeType = 'application/json';
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Products');

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Price', key: 'price', width: 12 },
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Stock', key: 'stock', width: 10 },
      ];

      products.forEach((p: any) => {
        worksheet.addRow({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          price: p.price,
          brand: p.brand || 'N/A',
          rating: p.rating,
          stock: p.stock,
        });
      });

      buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const duration = Date.now() - startTime;
    await this.redisTimeSeriesService.addTimeSeriesSample('ts:api_fetch_count', products.length);
    await this.redisTimeSeriesService.publishEvent('DATA_FETCH_EXPORT', {
      format,
      count: products.length,
      durationMs: duration,
    });

    return { buffer, fileName, mimeType };
  }

  /**
   * Bonus 2: Parse uploaded JSON/Excel buffer and insert into MongoDB robustly
   */
  async uploadAndImportFile(fileBuffer: Buffer, format: 'json' | 'excel'): Promise<{ insertedOrUpdated: number }> {
    const startTime = Date.now();

    let rawProducts: any[] = [];

    if (format === 'json') {
      rawProducts = JSON.parse(fileBuffer.toString('utf-8'));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);
      const worksheet = workbook.getWorksheet('Products') || workbook.worksheets[0];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values: any = row.values;
        rawProducts.push({
          id: Number(values[1]),
          title: String(values[2] || ''),
          description: String(values[3] || ''),
          category: String(values[4] || ''),
          price: Number(values[5] || 0),
          brand: String(values[6] || ''),
          rating: Number(values[7] || 0),
          stock: Number(values[8] || 0),
        });
      });
    }

    const documents: ProductDocument[] = rawProducts.map((p: any) => ({
      externalId: p.id,
      title: p.title || 'Untitled',
      description: p.description || '',
      category: p.category || 'general',
      price: p.price || 0,
      discountPercentage: p.discountPercentage,
      rating: p.rating,
      stock: p.stock,
      brand: p.brand,
      images: p.images || [],
      thumbnail: p.thumbnail || '',
      importedAt: new Date(),
    }));

    const result = await this.productsRepository.upsertProducts(documents);
    const totalProcessed = result.upsertedCount + result.modifiedCount;

    const duration = Date.now() - startTime;
    await this.redisTimeSeriesService.addTimeSeriesSample('ts:products_ingested_count', totalProcessed);
    await this.redisTimeSeriesService.publishEvent('DATA_PARSED_IMPORTED', {
      format,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      durationMs: duration,
    });

    return { insertedOrUpdated: totalProcessed };
  }

  /**
   * Search API with Mongo text index & pagination
   */
  async searchProducts(dto: SearchProductDto) {
    const startTime = Date.now();
    const result = await this.productsRepository.searchProducts(
      dto.q,
      dto.category,
      dto.minPrice,
      dto.maxPrice,
      dto.page,
      dto.limit,
    );

    const latency = Date.now() - startTime;
    await this.redisTimeSeriesService.addTimeSeriesSample('ts:search_queries', 1);
    await this.redisTimeSeriesService.addTimeSeriesSample('ts:search_latency_ms', latency);
    await this.redisTimeSeriesService.publishEvent('PRODUCT_SEARCH', {
      query: dto.q || '*',
      resultsCount: result.data.length,
      totalCount: result.total,
      page: result.page,
      latencyMs: latency,
    });

    return result;
  }
}
