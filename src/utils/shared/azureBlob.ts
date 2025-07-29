import { BlobServiceClient } from '@azure/storage-blob';

export function getBlobName({ platform, type = 'json', id }: { platform: string; type?: string; id: string }): string {
  const timestamp = Date.now();
  const safeId = Buffer.from(id).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return `${platform}/${type}/${safeId}-${timestamp}.${type}`;
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

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const data = JSON.stringify(jsonData);
  await blockBlobClient.upload(data, Buffer.byteLength(data));

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
  const matches = url.pathname.match(/\/([^\/]+)\/([^\/]+)$/);
  if (!matches) throw new Error('Invalid blob URL');
  const containerName = matches[1];
  const blobName = matches[2];
  return await getJsonFromBlob(containerName, blobName);
}
