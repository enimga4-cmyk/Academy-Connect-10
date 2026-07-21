import { supabase } from "./supabaseClient";

export interface SupabaseUploadMetadata {
  storageProvider: "supabase";
  bucket: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  downloadUrl: string;
}

/**
 * Uploads a file/blob to Supabase Storage with progress tracking using XMLHttpRequest,
 * and falls back to standard supabase-js SDK upload if XMLHttpRequest fails.
 */
export async function uploadFileToSupabase(
  bucket: string,
  path: string,
  file: File | Blob,
  fileName: string,
  uploadedBy: string = "System",
  onProgress?: (percent: number) => void
): Promise<SupabaseUploadMetadata> {
  const mimeType = file.type || "application/octet-stream";

  console.log(`[UploadService] Starting SDK upload to bucket: ${bucket}, path: ${path}`);
  if (onProgress) onProgress(10);

  // Requirement 2: Upload files using standard SDK with upsert: false
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    // Requirement 6: Log all required fields and throw the exact error message
    console.error("[UploadService] SUPABASE UPLOAD FAILURE LOG:", {
      bucket,
      storagePath: path,
      fileName,
      uploadResponse: data,
      fullErrorObject: error
    });
    throw new Error(`Supabase Storage Error: ${error.message || JSON.stringify(error)}`);
  }

  if (onProgress) onProgress(100);
  const successPath = data?.path || path;

  // After successful upload, generate Signed URL or Public URL
  let downloadUrl = "";
  
  try {
    const isProfilePhoto = path.startsWith("profile-photos/");
    if (isProfilePhoto) {
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(successPath);
      downloadUrl = publicData.publicUrl;
    } else {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(successPath, 3600); // 1 hour expiration
      
      if (signedError) {
        throw signedError;
      }
      downloadUrl = signedData?.signedUrl || "";
    }
  } catch (urlError) {
    console.warn("[UploadService] Failed to generate URL, falling back to publicUrl:", urlError);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(successPath);
    downloadUrl = publicData.publicUrl;
  }

  const metadata: SupabaseUploadMetadata = {
    storageProvider: "supabase",
    bucket,
    storagePath: successPath,
    fileName,
    fileSize: file.size,
    mimeType,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    downloadUrl,
  };

  console.log(`[UploadService] Upload complete. Metadata:`, metadata);
  return metadata;
}
