import { BlobServiceClient } from '@azure/storage-blob';

/**
 * Fetches and parses a JSON object from an Azure Blob URL
 */
export async function getBlobJson(blobUrl: string): Promise<any> {
  // Parse the blob URL
  const url = new URL(blobUrl);
  const matches = url.pathname.match(/\/([^\/]+)\/([^\/]+)$/);
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
