import { supabase } from "./supabaseClient";
import { uploadFileToSupabase, SupabaseUploadMetadata } from "./uploadService";

const BUCKET_NAME = "academy-connect-files";

/**
 * Uploads a PDF note to Supabase Storage.
 * Generates a unique filename and returns a JSON-stringified metadata object
 * containing all required metadata to be saved in Firestore.
 */
export async function uploadPdfToStorage(
  studentId: string,
  subject: string,
  fileName: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const fileHash = `${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}_${file.size}`;
  const localCacheKey = `uploaded_pdf_${studentId}_${fileHash}`;

  // Check local cache to avoid duplicate uploads
  const cachedUrl = localStorage.getItem(localCacheKey);
  if (cachedUrl) {
    console.log(`[StorageService] Duplicate upload avoided. Found cached upload:`, cachedUrl);
    if (onProgress) onProgress(100);
    return cachedUrl;
  }

  try {
    const timestamp = Date.now();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    
    // Requirement 3: Use storage paths like notes/{studentId}/{timestamp}-{originalFilename}
    const storagePath = `notes/${studentId}/${timestamp}-${cleanFileName}`;

    console.log(`[StorageService] Starting PDF Notes upload to path: ${storagePath}`);
    
    const metadata = await uploadFileToSupabase(
      BUCKET_NAME,
      storagePath,
      file,
      fileName,
      "Admin",
      onProgress
    );

    // Cache the result JSON in local storage
    const resultString = JSON.stringify(metadata);
    localStorage.setItem(localCacheKey, resultString);

    return resultString;
  } catch (error: any) {
    console.error("[StorageService] PDF upload failed with error:", error);
    // Propagate the exact error to prevent writing incomplete/incorrect metadata to Firestore
    throw error;
  }
}

/**
 * Uploads a profile photo (provided as base64 dataUrl) to Supabase Storage.
 * Supports students and admins.
 */
export async function uploadProfilePhoto(
  userId: string,
  dataUrl: string,
  originalFileName: string = "profile.png"
): Promise<SupabaseUploadMetadata> {
  try {
    // Convert base64 data URL to a Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const cleanFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    
    // Structure: profile-photos/{userId}/{timestamp}-{random}-{filename}
    const storagePath = `profile-photos/${userId}/${timestamp}-${random}-${cleanFileName}`;

    console.log(`[StorageService] Uploading profile photo to: ${storagePath}`);

    const metadata = await uploadFileToSupabase(
      BUCKET_NAME,
      storagePath,
      blob,
      originalFileName,
      "User"
    );

    return metadata;
  } catch (error: any) {
    console.error("[StorageService] Profile photo upload failed:", error);
    throw error;
  }
}

/**
 * Uploads a progress or performance report to Supabase Storage.
 */
export async function uploadReportToStorage(
  studentId: string,
  reportBlob: Blob,
  fileName: string
): Promise<SupabaseUploadMetadata> {
  try {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    
    // Structure: reports/{studentId}/{timestamp}-{random}-{filename}
    const storagePath = `reports/${studentId}/${timestamp}-${random}-${cleanFileName}`;

    console.log(`[StorageService] Uploading report to: ${storagePath}`);

    const metadata = await uploadFileToSupabase(
      BUCKET_NAME,
      storagePath,
      reportBlob,
      fileName,
      "Admin"
    );

    return metadata;
  } catch (error: any) {
    console.error("[StorageService] Report upload failed:", error);
    throw error;
  }
}

/**
 * Deletes a file from Supabase Storage.
 */
export async function deleteFileFromStorage(storagePath: string): Promise<void> {
  if (!storagePath) return;
  
  // Skip if it's a local base64 fallback or absolute external URL
  if (
    storagePath.startsWith("data:") ||
    storagePath.startsWith("http://") ||
    storagePath.startsWith("https://")
  ) {
    return;
  }

  try {
    console.log(`[StorageService] Deleting file from Supabase Storage: ${storagePath}`);
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    
    if (error) {
      throw error;
    }
    console.log(`[StorageService] Successfully deleted file: ${storagePath}`);
  } catch (error: any) {
    console.error(`[StorageService] Failed to delete file ${storagePath}:`, error.message || error);
  }
}
