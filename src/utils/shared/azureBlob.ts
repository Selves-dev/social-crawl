export function getBlobName({ platform, type = 'json', id }: { platform: string; type?: string; id: string }): string {
  const timestamp = Date.now();
  // Use the id as a directory, e.g. platform/type/id/timestamp.type
  return `${platform}/${type}/${id}/${timestamp}.${type}`;
}
export function getPlatform(link: string): string {
  if (/instagram\.com/.test(link)) return 'instagram';
  if (/tiktok\.com/.test(link)) return 'tiktok';
  if (/youtube\.com/.test(link)) return 'youtube';
  if (/google\./.test(link)) return 'google';
  return 'generic';
}
export async function updateBlobJson(blobUrl: string, updateFn: (data: any) => any): Promise<void> {
  console.log('[updateBlobJson] Called with blobUrl:', blobUrl);
  const blobJson = await getBlobJson(blobUrl);
  console.log('[updateBlobJson] Fetched blob JSON:', blobJson);
  const updatedJson = updateFn(blobJson);
  console.log('[updateBlobJson] Updated JSON:', updatedJson);
  const url = new URL(blobUrl);
  const matches = url.pathname.match(/\/([^\/]+)\/(.+)$/);
  if (!matches) throw new Error('Invalid blob URL');
  const containerName = matches[1];
  const blobName = matches[2];
  console.log('[updateBlobJson] Container:', containerName, 'Blob:', blobName);
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) throw new Error('Missing Azure Storage connection string');
  console.log('[updateBlobJson] Using connection string:', process.env.AZURE_STORAGE_CONNECTION_STRING ? process.env.AZURE_STORAGE_CONNECTION_STRING.slice(0, 20) + '...' : 'undefined');
  const container = blobServiceClient.getContainerClient(containerName);
  const blob = container.getBlockBlobClient(blobName);
  await blob.upload(JSON.stringify(updatedJson), Buffer.byteLength(JSON.stringify(updatedJson)), { blobHTTPHeaders: { blobContentType: 'application/json' } });
  console.log('[updateBlobJson] Uploaded updated JSON to blob:', blob.url);
}
// ...existing code...

export function getBlobServiceClient(): BlobServiceClient | null {
  const connectionString = process.env["AZURE_STORAGE_CONNECTION_STRING"];
  if (!connectionString) {
    // Optionally log error here, or let caller handle
    return null;
  }
  return BlobServiceClient.fromConnectionString(connectionString);
}
import { BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol, StorageSharedKeyCredential } from '@azure/storage-blob';

export async function generateBlobSasUrl(blobClient: any, expiryMinutes = 60): Promise<string> {
  const urlParts = blobClient.url.match(/https:\/\/(.*?)\.blob\.core\.windows\.net\/(.*?)\/(.*)/);
  if (!urlParts) throw new Error('Invalid blob URL');
  const accountName = urlParts[1];
  const containerName = urlParts[2];
  const blobName = urlParts[3];
  // You may need to get the account key from your blobServiceClient
  const accountKey = blobClient.credential?.accountKey || blobClient?.accountKey;
  if (!accountKey) throw new Error('Missing Azure Storage account key for SAS generation');
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
// ...existing code...
import { BlobServiceClient } from '@azure/storage-blob';
/**
 * Uploads a JSON object to Azure Blob Storage
 */
export async function uploadJsonToBlob(containerName: string, blobName: string, data: any): Promise<string> {
  const connectionString = process.env["AZURE_STORAGE_CONNECTION_STRING"];
  if (!connectionString) throw new Error('Missing Azure Storage connection string');
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const jsonString = JSON.stringify(data);
  await blobClient.upload(jsonString, Buffer.byteLength(jsonString), {
    blobHTTPHeaders: { blobContentType: 'application/json' }
  });
  return blobClient.url;
}

/**
 * Fetches and parses a JSON object from an Azure Blob URL
 */
export async function getBlobJson(blobUrl: string): Promise<any> {
  // Parse the blob URL
  const url = new URL(blobUrl);
  // Match first segment as container, rest as blob name
  const matches = url.pathname.match(/^\/([^\/]+)\/(.+)$/);
  if (!matches) throw new Error('Invalid blob URL');
  const containerName = matches[1];
  const blobName = matches[2];

  // Get connection string from env
  const connectionString = process.env["AZURE_STORAGE_CONNECTION_STRING"];
  if (!connectionString) throw new Error('Missing Azure Storage connection string');

  // Create blob client
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  // Download blob content
  const downloadBlockBlobResponse = await blobClient.download();
  if (!downloadBlockBlobResponse.readableStreamBody) {
    throw new Error('Blob has no readable stream body');
  }
  const downloaded = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);
  return JSON.parse(downloaded.toString());
}

// Helper to convert stream to buffer
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}
