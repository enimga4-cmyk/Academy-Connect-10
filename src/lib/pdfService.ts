import { getFreshSignedUrl } from "./downloadService";

// In-memory cache for resolved Supabase Storage signed/public URLs to avoid duplicate API calls
const resolvedUrlCache = new Map<string, string>();
const BUCKET_NAME = "academy-connect-files";

/**
 * Resolves a Supabase storage path or generic URL to a secure direct HTTPS download/signed URL.
 * Implements a 15-second timeout and robust caching.
 */
export async function getPdfDownloadUrl(pdfUrl: string): Promise<string> {
  console.log(`[PDF Service Debug] Resolving PDF URL:`, pdfUrl);
  if (!pdfUrl) {
    throw new Error("PDF path is missing.");
  }

  // If it's already a direct link, return it
  if (
    pdfUrl.startsWith("http://") ||
    pdfUrl.startsWith("https://") ||
    pdfUrl.startsWith("data:")
  ) {
    console.log(`[PDF Service Debug] Already a direct link:`, pdfUrl);
    return pdfUrl;
  }

  // Clean the path if it starts with gs:// or other firebase prefix formats (for compatibility)
  let storagePath = pdfUrl;
  if (storagePath.startsWith("gs://")) {
    const parts = storagePath.substring(5).split("/");
    parts.shift(); // remove bucket
    storagePath = parts.join("/");
  }

  // Return cached resolved URL if exists in memory
  if (resolvedUrlCache.has(storagePath)) {
    const cached = resolvedUrlCache.get(storagePath)!;
    console.log(`[PDF Service Debug] Returning memory-cached resolved URL:`, cached);
    return cached;
  }

  // Return cached resolved URL if exists in localStorage
  const persistedKey = `resolved_supabase_url_${storagePath.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const persistedUrl = localStorage.getItem(persistedKey);
  if (persistedUrl) {
    console.log(`[PDF Service Debug] Returning persisted resolved URL from local storage:`, persistedUrl);
    resolvedUrlCache.set(storagePath, persistedUrl);
    return persistedUrl;
  }

  // Fetch with a 15-second timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout: PDF URL resolution took too long.")), 15000);
  });

  const fetchPromise = (async () => {
    // Generate a fresh signed URL (valid for 1 hour)
    const signedUrl = await getFreshSignedUrl(BUCKET_NAME, storagePath, 3600);
    
    // Cache the resolved URL
    resolvedUrlCache.set(storagePath, signedUrl);
    localStorage.setItem(persistedKey, signedUrl);
    
    return signedUrl;
  })();

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    console.error("[PDF Service] Failed to resolve PDF download URL:", error);
    if (error.message?.includes("Permission") || error.status === 401 || error.status === 403) {
      throw new Error("Permission denied.");
    } else if (error.message?.includes("not found") || error.status === 404) {
      throw new Error("PDF file not found in storage.");
    }
    throw new Error("Failed to retrieve PDF view link.");
  }
}
