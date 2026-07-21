import { supabase } from "./supabaseClient";

/**
 * Downloads a file from Supabase Storage directly to the user's device.
 */
export async function downloadFileFromSupabase(
  bucket: string,
  storagePath: string,
  fileName: string
): Promise<void> {
  try {
    console.log(`[DownloadService] Initiating download for path: ${storagePath} in bucket: ${bucket}`);

    // Try downloading the file blob directly
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Received empty data from storage");
    }

    // Create dynamic download link
    const blobUrl = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    console.log(`[DownloadService] Download successful: ${fileName}`);
  } catch (error: any) {
    console.error("[DownloadService] Download failed:", error);
    throw new Error(`Failed to download file from Supabase: ${error.message || error}`);
  }
}

/**
 * Obtains a fresh signed URL for a given storage path, useful for expired URLs.
 */
export async function getFreshSignedUrl(
  bucket: string,
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error("No signed URL returned from Supabase");
    }

    return data.signedUrl;
  } catch (error: any) {
    console.error(`[DownloadService] Failed to fetch signed URL for path ${storagePath}:`, error);
    // Fallback: Try returning public URL as last resort
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }
}
