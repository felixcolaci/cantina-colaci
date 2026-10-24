import imageCompression from 'browser-image-compression'

const OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1200 }

// browser-image-compression runs in a Worker by default and wires the
// Worker's own 'error' event straight to the compression promise's reject
// (see its source: `worker.addEventListener('error', reject)`) -- so a
// Worker-level failure (observed with HEIC photos straight from an iPhone
// camera; less of an issue with an already-compressed JPEG from the photo
// library) surfaces as a raw ErrorEvent, not an Error, and callers silently
// swallowing "not an Error we expected" lost the whole upload with zero
// symptom. Retry on the main thread once before giving up, and as a last
// resort fall back to the original file rather than losing the photo.
export async function compressImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, { ...OPTIONS, useWebWorker: true })
  } catch {
    try {
      return await imageCompression(file, { ...OPTIONS, useWebWorker: false })
    } catch {
      return file
    }
  }
}
