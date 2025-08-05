import { 
  BlobServiceClient, 
  BlobSASPermissions, 
  generateBlobSASQueryParameters, 
  SASProtocol, 
  StorageSharedKeyCredential,
  BlockBlobClient,
  ContainerClient
} from '@azure/storage-blob';

// Types
interface BlobUrlParts {
  containerName: string;
  blobName: string;
  accountName?: string;
}

interface BlobNameOptions {
  platform: string;
  type?: string;
  id: string;
}

// Constants
const PLATFORM_PATTERNS = new Map([
  [/instagram\.com/, 'instagram'],
  [/tiktok\.com/, 'tiktok'],
  [/youtube\.com/, 'youtube'],
  [/google\./, 'google']
]);

const DEFAULT_SAS_EXPIRY_MINUTES = 60;
const JSON_CONTENT_TYPE = 'application/json';

// Logger utility
import { logger } from './logger';
function getLogger() {
  return logger;
}

// Core Azure Blob Service
class AzureBlobService {
  private static client: BlobServiceClient | null = null;
  
  static getClient(): BlobServiceClient {
    const connectionString = process.env["azure-storage-connection-string"];
    if (!connectionString) {
      throw new Error('Missing Azure Storage connection string');
    }
    
    if (!this.client) {
      this.client = BlobServiceClient.fromConnectionString(connectionString);
    }
    
    return this.client;
  }

  static parseUrl(blobUrl: string): BlobUrlParts {
    const url = new URL(blobUrl);
    const matches = url.pathname.match(/^\/([^\/]+)\/(.+)$/);
    
    if (!matches) {
      throw new Error('Invalid blob URL format');
    }

    const accountMatch = url.hostname.match(/^(.*?)\.blob\.core\.windows\.net$/);
    
    return {
      containerName: matches[1],
      blobName: matches[2],
      accountName: accountMatch?.[1]
    };
  }

  static getBlockBlobClient(containerName: string, blobName: string): BlockBlobClient {
    return this.getClient()
      .getContainerClient(containerName)
      .getBlockBlobClient(blobName);
  }
}

// Utility functions
export function getBlobName({ platform, type = 'json', id }: BlobNameOptions): string {
  const timestamp = Date.now();
  return `${platform}/${type}/${id}/${timestamp}.${type}`;
}

export function getPlatform(link: string): string {
  for (const [pattern, platform] of PLATFORM_PATTERNS) {
    if (pattern.test(link)) return platform;
  }
  return 'generic';
}

// Stream helper
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    readableStream
      .on('data', (data) => chunks.push(Buffer.from(data)))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

// Main blob operations
export async function uploadJsonToBlob(
  containerName: string, 
  blobName: string, 
  data: any
): Promise<string> {
  const blobClient = AzureBlobService.getBlockBlobClient(containerName, blobName);
  const jsonString = JSON.stringify(data);
  
  await blobClient.upload(jsonString, Buffer.byteLength(jsonString), {
    blobHTTPHeaders: { blobContentType: JSON_CONTENT_TYPE }
  });
  
  return blobClient.url;
}

export async function getBlobJson(blobUrl: string): Promise<any> {
  const logger = getLogger();
  
  try {
    const { containerName, blobName } = AzureBlobService.parseUrl(blobUrl);
    const blobClient = AzureBlobService.getClient()
      .getContainerClient(containerName)
      .getBlobClient(blobName);

    const response = await blobClient.download();
    
    if (!response.readableStreamBody) {
      throw new Error('Blob has no readable stream body');
    }
    
    const buffer = await streamToBuffer(response.readableStreamBody);
    return JSON.parse(buffer.toString());
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('getBlobJson: Error fetching or parsing blob', err);
    throw err;
  }
}

export async function updateBlobJson(
  blobUrl: string, 
  updateFn: (data: any) => any
): Promise<void> {
  const logger = getLogger();
  logger.debug('[updateBlobJson] Called with blobUrl', { blobUrl });

  try {
    // Fetch current data
    const blobJson = await getBlobJson(blobUrl);
    logger.debug('[updateBlobJson] Fetched blob JSON', { blobJson });

    // Apply update
    const updatedJson = updateFn(blobJson);
    logger.debug('[updateBlobJson] Updated JSON', { updatedJson });

    // Parse URL and upload
    const { containerName, blobName } = AzureBlobService.parseUrl(blobUrl);
    logger.info('[updateBlobJson] Container and Blob', { containerName, blobName });

    const blobClient = AzureBlobService.getBlockBlobClient(containerName, blobName);
    const jsonString = JSON.stringify(updatedJson);
    
    await blobClient.upload(jsonString, Buffer.byteLength(jsonString), {
      blobHTTPHeaders: { blobContentType: JSON_CONTENT_TYPE }
    });
    
    logger.debug('[updateBlobJson] Uploaded updated JSON to blob', { url: blobClient.url });
    
  } catch (error) {
    logger.error('[updateBlobJson] Failed to update blob', error);
    throw error;
  }
}

export async function generateBlobSasUrl(
  blobClient: any, 
  expiryMinutes = DEFAULT_SAS_EXPIRY_MINUTES
): Promise<string> {
  const { containerName, blobName, accountName } = AzureBlobService.parseUrl(blobClient.url);
  
  if (!accountName) {
    throw new Error('Could not extract account name from blob URL');
  }
  
  const accountKey = blobClient.credential?.accountKey || blobClient?.accountKey;
  if (!accountKey) {
    throw new Error('Missing Azure Storage account key for SAS generation');
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const sasParams = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn,
    protocol: SASProtocol.Https,
  }, sharedKeyCredential);

  return `${blobClient.url}?${sasParams.toString()}`;
}

// Legacy compatibility
export function getBlobServiceClient(): BlobServiceClient | null {
  try {
    return AzureBlobService.getClient();
  } catch {
    return null;
  }
}