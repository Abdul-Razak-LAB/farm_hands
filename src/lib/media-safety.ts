const DEFAULT_IMAGE_MAX_WIDTH = 1600;
const DEFAULT_IMAGE_QUALITY = 0.78;

export async function compressImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const imageBitmap = await createImageBitmap(file);
  const scale = imageBitmap.width > DEFAULT_IMAGE_MAX_WIDTH
    ? DEFAULT_IMAGE_MAX_WIDTH / imageBitmap.width
    : 1;

  const width = Math.round(imageBitmap.width * scale);
  const height = Math.round(imageBitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(imageBitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', DEFAULT_IMAGE_QUALITY);
  });

  if (!blob) {
    return file;
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function getVideoDurationInSeconds(file: File) {
  if (!file.type.startsWith('video/')) {
    return 0;
  }

  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Unable to read video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

export async function isNearStorageQuota(threshold = 0.85) {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return false;
  }

  const estimate = await navigator.storage.estimate();
  if (!estimate.quota || !estimate.usage) {
    return false;
  }

  return estimate.usage / estimate.quota >= threshold;
}
