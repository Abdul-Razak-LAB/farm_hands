type SignedUpload = {
  uploadId: string;
  uploadUrl: string;
  fileUrl: string;
  method: 'PUT';
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function requestSignedUpload(endpoint: string, file: File) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    }),
  });

  const json = (await response.json()) as ApiEnvelope<SignedUpload>;
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || 'Unable to get signed upload URL');
  }

  return json.data;
}

async function putWithProgress(uploadUrl: string, file: File, onProgress?: (progress: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed due to network error'));
    xhr.send(file);
  });
}

export async function uploadFileWithSignedEndpoint(
  signedUploadEndpoint: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  const signed = await requestSignedUpload(signedUploadEndpoint, file);
  await putWithProgress(signed.uploadUrl, file, onProgress);
  return signed.fileUrl;
}
