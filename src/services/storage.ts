import {Storage} from '@google-cloud/storage';
import {PROJECT_ID, BUCKET_NAME} from './gcp.ts';

const storage = new Storage({projectId: PROJECT_ID});
const bucket = storage.bucket(BUCKET_NAME);

export async function uploadFile(
  fileBuffer: Buffer,
  destinationPath: string,
  mimeType: string
): Promise<void> {
  const file = bucket.file(destinationPath);

  await file.save(fileBuffer, {
    contentType: mimeType,
    metadata: {
      cacheControl: 'private, max-age=0',
    },
  });

  console.log(`Uploaded to gs://${BUCKET_NAME}/${destinationPath}`);
}

export async function getSignedUrl(
  path: string,
  expiresInMinutes: number = 15
): Promise<[string, number]> {
  const expiry = Date.now() + expiresInMinutes * 60 * 1000;
  const [url] = await bucket.file(path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: expiry,
  });

  return [url, expiry];
}

export async function deleteFile(path: string): Promise<void> {
  await bucket.file(path).delete();
  console.log(`Deleted gs://${BUCKET_NAME}/${path}`);
}

export async function fileExists(path: string): Promise<boolean> {
  const [exists] = await bucket.file(path).exists();
  return exists;
}
