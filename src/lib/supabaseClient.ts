import { createClient } from "@supabase/supabase-js";

let supabaseInstance: any = null;

// In-memory mock storage for files when Supabase is unconfigured
const mockStorage = new Map<string, Blob>();

function createMockSupabaseClient() {
  console.log("[Supabase Mock] Using in-memory fallback client because VITE_SUPABASE_URL is not set.");
  return {
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File | Blob, options?: any) {
            console.log(`[Supabase Mock] upload to ${bucket}/${path}`);
            mockStorage.set(`${bucket}/${path}`, file);
            
            try {
              if (file instanceof File || file instanceof Blob) {
                const fileMeta = {
                  name: (file as File).name || "file",
                  size: file.size,
                  type: file.type,
                  uploadedAt: new Date().toISOString()
                };
                localStorage.setItem(`mock_storage_meta_${bucket}_${path}`, JSON.stringify(fileMeta));
              }
            } catch (e) {
              // Ignore localstorage errors
            }

            return { data: { path }, error: null };
          },
          async download(path: string) {
            console.log(`[Supabase Mock] download from ${bucket}/${path}`);
            const blob = mockStorage.get(`${bucket}/${path}`);
            if (blob) {
              return { data: blob, error: null };
            }
            
            let dummyBlob: Blob;
            if (path.endsWith(".pdf")) {
              dummyBlob = new Blob(["%PDF-1.4 mock pdf content"], { type: "application/pdf" });
            } else {
              dummyBlob = new Blob(["mock image content"], { type: "image/png" });
            }
            return { data: dummyBlob, error: null };
          },
          async remove(paths: string[]) {
            console.log(`[Supabase Mock] remove from ${bucket}:`, paths);
            paths.forEach(p => {
              mockStorage.delete(`${bucket}/${p}`);
              localStorage.removeItem(`mock_storage_meta_${bucket}_${p}`);
            });
            return { data: null, error: null };
          },
          getPublicUrl(path: string) {
            console.log(`[Supabase Mock] getPublicUrl for ${bucket}/${path}`);
            const blob = mockStorage.get(`${bucket}/${path}`);
            let url = "";
            if (blob) {
              url = URL.createObjectURL(blob);
            } else {
              url = `https://picsum.photos/200`;
            }
            return { data: { publicUrl: url } };
          },
          async createSignedUrl(path: string, expiresIn: number) {
            console.log(`[Supabase Mock] createSignedUrl for ${bucket}/${path}`);
            const blob = mockStorage.get(`${bucket}/${path}`);
            let url = "";
            if (blob) {
              url = URL.createObjectURL(blob);
            } else {
              if (path.endsWith(".pdf")) {
                url = "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDYKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDYKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDYKL0xlbmd0aCA0OQo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyIFRkCihNb2NrIFBERiBDb250ZW50IC0gU3VwYWJhc2UgT2ZmbOfflineeSlCg==\n";
              } else {
                url = `https://picsum.photos/200`;
              }
            }
            return { data: { signedUrl: url }, error: null };
          }
        };
      }
    }
  };
}

function getClient() {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      supabaseInstance = createMockSupabaseClient();
    } else {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    try {
      const client = getClient();
      const value = Reflect.get(client, prop);
      if (typeof value === "function") {
        return value.bind(client);
      }
      return value;
    } catch (err: any) {
      if (prop === "then" || prop === "toJSON" || typeof prop === "symbol") {
        return undefined;
      }
      throw err;
    }
  }
});

