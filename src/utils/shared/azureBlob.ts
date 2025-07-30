import { BlobServiceClient } from '@azure/storage-blob';

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

export async function uploadJsonToBlob(containerName: string, blobName: string, jsonData: any): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');

  console.log('[uploadJsonToBlob] Using connection string:', connectionString ? connectionString.slice(0, 20) + '...' : 'undefined');
  console.log('[uploadJsonToBlob] Container:', containerName, 'Blob:', blobName);
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  console.log('[uploadJsonToBlob] Container exists or created:', containerName);

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const data = JSON.stringify(jsonData);
  await blockBlobClient.upload(data, Buffer.byteLength(data));
  console.log('[uploadJsonToBlob] Uploaded JSON to blob:', blockBlobClient.url);

  return blockBlobClient.url;
}

export async function getJsonFromBlob(containerName: string, blobName: string): Promise<any> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const downloadBlockBlobResponse = await blockBlobClient.download();
  const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody ?? null);
  return JSON.parse(downloaded);
}

export async function updateJsonInBlob(containerName: string, blobName: string, updateFn: (data: any) => any): Promise<string> {
  const currentData = await getJsonFromBlob(containerName, blobName);
  const updatedData = updateFn(currentData);
  return await uploadJsonToBlob(containerName, blobName, updatedData);
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

// Helper to convert stream to string
async function streamToString(readableStream: NodeJS.ReadableStream | null): Promise<string> {
  if (!readableStream) return '';
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

// Export getBlobJson for compatibility
export async function getBlobJson(blobUrl: string): Promise<any> {
  // Parse the blob URL
  const url = new URL(blobUrl);
  // Remove leading slash and split
  const segments = url.pathname.replace(/^\//, '').split('/');
  if (segments.length < 2) throw new Error('Invalid blob URL');
  const containerName = segments[0];
  const blobName = segments.slice(1).join('/');
  return await getJsonFromBlob(containerName, blobName);
}

export function getBlobServiceClient(): BlobServiceClient | null {
  const connectionString = process.env["AZURE_STORAGE_CONNECTION_STRING"];
  if (!connectionString) {
    // Optionally log error here, or let caller handle
    return null;
  }
  return BlobServiceClient.fromConnectionString(connectionString);
}
