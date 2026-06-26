export function getStorageBucketName(): string {
  const bucketName = process.env.STORAGE_BUCKET_NAME?.trim();
  if (!bucketName) {
    throw new Error("STORAGE_BUCKET_NAME env var is required. Set it in .env");
  }
  return bucketName;
}
