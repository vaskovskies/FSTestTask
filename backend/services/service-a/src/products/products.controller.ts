import { Controller, Get, Post, Query, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { SearchProductDto } from './dto/search-product.dto';
import * as diskFs from 'fs';
import * as path from 'path';

@ApiTags('Products')
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('fetch-and-save')
  @ApiOperation({ summary: 'Fetch products from dummyjson.com API and save to JSON/Excel file (Bonus 1)' })
  @ApiQuery({ name: 'format', enum: ['json', 'excel'], required: false })
  async fetchAndSave(@Query('format') format: 'json' | 'excel' = 'json') {
    return this.productsService.fetchAndSaveData(format);
  }

  @Post('upload-and-import')
  @ApiOperation({ summary: 'Upload & parse JSON/Excel file, then insert/upsert into Mongo robustly (Bonus 2)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndImport(
    @UploadedFile() file?: Express.Multer.File,
    @Body('filePath') bodyFilePath?: string,
    @Body('format') bodyFormat?: 'json' | 'excel',
  ) {
    let filePathToProcess = bodyFilePath;
    let format = bodyFormat || 'json';

    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      format = ext === '.xlsx' ? 'excel' : 'json';
      const tempPath = path.join(process.cwd(), 'data', `upload_${Date.now()}_${file.originalname}`);
      diskFs.writeFileSync(tempPath, file.buffer);
      filePathToProcess = tempPath;
    }

    if (!filePathToProcess) {
      // Default to auto-generating and processing if no file provided
      const autoFetch = await this.productsService.fetchAndSaveData(format);
      filePathToProcess = autoFetch.filePath;
    }

    return this.productsService.uploadAndImportFile(filePathToProcess, format);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products with text indexing, filters, and efficient pagination' })
  async search(@Query() dto: SearchProductDto) {
    return this.productsService.searchProducts(dto);
  }
}
