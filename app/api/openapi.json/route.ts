import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const openApiSpec = {
    openapi: '3.1.0',
    info: {
      title: 'Skalybr API',
      version: '0.1.0',
      description:
        'The modern, ultra-fast self-hosted e-book server and reader for Calibre libraries.',
      contact: {
        name: 'Skalybr Project',
        url: 'https://github.com/demeesterroeland/skalybr',
      },
    },
    paths: {
      '/api/v1/libraries': {
        get: {
          summary: 'List available Calibre libraries',
          responses: {
            '200': {
              description: 'List of discovered Calibre libraries',
            },
          },
        },
      },
      '/api/v1/facets': {
        get: {
          summary: 'Get filter facets (authors, tags, series, collections, formats)',
          parameters: [
            {
              name: 'library',
              in: 'query',
              schema: { type: 'string' },
              description: 'Calibre library name',
            },
          ],
          responses: {
            '200': { description: 'Filter facet counts' },
          },
        },
      },
      '/api/v1/books': {
        get: {
          summary: 'List and search books',
          parameters: [
            { name: 'library', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'author', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'series', in: 'query', schema: { type: 'string' } },
            { name: 'collection', in: 'query', schema: { type: 'string' } },
            { name: 'format', in: 'query', schema: { type: 'string' } },
            {
              name: 'sort',
              in: 'query',
              schema: { type: 'string', enum: ['title', 'authors', 'pubdate', 'rating', 'id'] },
            },
            { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 30 } },
          ],
          responses: {
            '200': { description: 'Paginated list of flattened books' },
          },
        },
      },
      '/api/v1/books/{id}': {
        get: {
          summary: 'Get book details by ID',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'library', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Book details' },
            '404': { description: 'Book not found' },
          },
        },
        put: {
          summary: 'Update book metadata',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'library', in: 'query', schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    rating: { type: 'number', minimum: 0, maximum: 5 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Updated book record' },
          },
        },
        delete: {
          summary: 'Delete book',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'library', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Deletion confirmation' },
          },
        },
      },
      '/api/v1/books/{id}/cover': {
        get: {
          summary: 'Stream resized WebP/JPEG cover image',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'library', in: 'query', schema: { type: 'string' } },
            { name: 'width', in: 'query', schema: { type: 'integer', default: 360 } },
            { name: 'format', in: 'query', schema: { type: 'string', enum: ['webp', 'jpeg'], default: 'webp' } },
          ],
          responses: {
            '200': { description: 'Cover image binary stream' },
          },
        },
      },
      '/api/v1/books/{id}/file/{format}': {
        get: {
          summary: 'Download e-book file format',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'format', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'library', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'E-book binary file' },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
