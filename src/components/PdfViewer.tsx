import React, { useEffect, useState, useRef } from "react";
import { FileText, Download, X, AlertTriangle, RefreshCw } from "lucide-react";
import { getPdfDownloadUrl } from "../lib/pdfService";

// Dynamic hook to load PDF.js library and worker from CDN
export function preloadPdfJs() {
  if (typeof window === "undefined" || (window as any).pdfjsLib) {
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  script.async = true;
  script.onload = () => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  };
  document.body.appendChild(script);
}

export function usePdfJs() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        setLoaded(true);
      } else {
        setError("Failed to initialize PDF engine.");
      }
    };
    script.onerror = () => {
      setError("Failed to load PDF rendering library.");
    };
    document.body.appendChild(script);
  }, []);

  return { loaded, error };
}

interface PdfPageProps {
  pdf: any;
  pageNum: number;
  scale?: number;
}

function PdfPage({ pdf, pageNum, scale = 1.2 }: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Load viewport aspect ratio once to prevent layout shifting
  useEffect(() => {
    let active = true;
    async function getPageSize() {
      try {
        const page = await pdf.getPage(pageNum);
        if (!active) return;
        const viewport = page.getViewport({ scale: 1 });
        setAspectRatio(viewport.width / viewport.height);
      } catch (err) {
        console.error(`[PdfPage] Error fetching page ${pageNum} dimensions:`, err);
      }
    }
    getPageSize();
    return () => {
      active = false;
    };
  }, [pdf, pageNum]);

  // 2. Intersection Observer to enable on-demand page rendering (virtualization)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
      },
      {
        root: null, // use browser viewport
        rootMargin: "350px", // Pre-render pages 350px before entering viewport for a seamless scroll
        threshold: 0.01,
      }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  // 3. Render page on canvas when in view
  useEffect(() => {
    let active = true;

    // Cleanup previous render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (e) {
        // ignore
      }
      renderTaskRef.current = null;
    }

    if (!isVisible) {
      setLoading(false);
      return;
    }

    async function renderPage() {
      try {
        setLoading(true);
        setRenderError(null);
        const page = await pdf.getPage(pageNum);
        if (!active) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || !active) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        // Support high-DPI displays for perfectly sharp text and charts
        const dpr = window.devicePixelRatio || 1;
        canvas.height = viewport.height * dpr;
        canvas.width = viewport.width * dpr;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.width = `${viewport.width}px`;

        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (active) {
          setLoading(false);
          console.log(`[PdfPage] Rendered page ${pageNum} successfully at scale ${scale}.`);
        }
      } catch (err: any) {
        if (err.name === "RenderingCancelledException" || err.message?.includes("cancelled")) {
          // Normal expected cancellation
          return;
        }
        console.error(`[PdfPage] Render error on page ${pageNum}:`, err);
        if (active) {
          setRenderError(err.message || String(err));
          setLoading(false);
        }
      }
    }

    // Debounce rendering slightly to smooth over fast scroll and zoom gestures
    const timeoutId = setTimeout(() => {
      renderPage();
    }, 40);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [pdf, pageNum, scale, isVisible]);

  // Fallback aspect ratio is A4 (1 : 1.414)
  const heightStyle = aspectRatio ? { aspectRatio: `${aspectRatio}` } : { minHeight: "500px" };

  return (
    <div
      ref={containerRef}
      style={heightStyle}
      className="relative w-full my-3 flex flex-col items-center bg-white dark:bg-slate-900 p-2 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800/80 transition-all duration-300"
    >
      <div className="absolute top-2 left-2 z-10 text-[10px] text-slate-400 font-bold select-none bg-white/85 dark:bg-slate-900/85 px-2 py-0.5 rounded border border-slate-150 dark:border-slate-800">
        Page {pageNum} of {pdf.numPages}
      </div>

      {isVisible ? (
        <>
          {loading && !canvasRef.current?.width && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 rounded-xl">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="text-xs text-slate-500 font-semibold">Loading Page {pageNum}...</span>
              </div>
            </div>
          )}
          {renderError && (
            <div className="absolute inset-0 flex items-center justify-center bg-rose-50/10 p-4">
              <div className="text-rose-500 text-xs p-4 border border-dashed border-rose-200 rounded-lg bg-rose-50/20">
                Failed to render page {pageNum}: {renderError}
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto rounded-md shadow-xs border border-slate-200/40 dark:border-slate-700/40"
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200/50 dark:border-slate-800/50">
          <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 stroke-[1.2] mb-1 animate-pulse" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Page {pageNum} (Virtual)</span>
        </div>
      )}
    </div>
  );
}

interface PdfViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function PdfViewer({ url, title, onClose }: PdfViewerProps) {
  const { loaded: pdfjsLoaded, error: pdfjsLoadError } = usePdfJs();
  const [pdf, setPdf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const touchStartRef = useRef<{
    distance: number;
    scale: number;
    x: number;
    y: number;
    center: { x: number; y: number };
  } | null>(null);
  const lastTapRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scale <= 1.25) {
      setTransform({ scale: 1, x: 0, y: 0 });
    }
  }, [scale]);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartRef.current = {
        distance: dist,
        scale: scale,
        x: transform.x,
        y: transform.y,
        center: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = {
        distance: 0,
        scale: scale,
        x: transform.x,
        y: transform.y,
        center: { x: t.clientX, y: t.clientY }
      };

      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scale > 1.2) {
          setScale(1.2);
          setTransform({ scale: 1, x: 0, y: 0 });
        } else {
          setScale(2.0);
          setTransform({ scale: 1, x: 0, y: 0 });
        }
      }
      lastTapRef.current = now;
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;

    if (e.touches.length === 2 && touchStartRef.current.distance > 0) {
      e.preventDefault(); // Prevent native zoom/scrolling while pinching
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = dist / touchStartRef.current.distance;

      const targetScale = touchStartRef.current.scale * factor;
      if (targetScale >= 0.8 && targetScale <= 2.8) {
        setTransform(prev => ({
          ...prev,
          scale: factor
        }));
      }
    } else if (e.touches.length === 1 && touchStartRef.current.distance === 0) {
      // Panning allowed only when zoomed in
      if (scale > 1.2) {
        const t = e.touches[0];
        const dx = t.clientX - touchStartRef.current.center.x;
        const dy = t.clientY - touchStartRef.current.center.y;

        // Prevent default only for horizontal panning, ensuring vertical swipe smoothly scrolls pages
        if (Math.abs(dx) > Math.abs(dy)) {
          e.preventDefault();
        }

        setTransform(prev => ({
          ...prev,
          x: touchStartRef.current!.x + dx,
          y: touchStartRef.current!.y + dy
        }));
      }
    }
  };

  const onTouchEnd = () => {
    if (!touchStartRef.current) return;

    if (touchStartRef.current.distance > 0 && transform.scale !== 1) {
      const finalScale = scale * transform.scale;
      setScale(Math.min(Math.max(1.0, finalScale), 2.5));
      setTransform({ scale: 1, x: 0, y: 0 });
    }
    touchStartRef.current = null;
  };

  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    let xhr: XMLHttpRequest | null = null;

    async function resolveAndLoad() {
      try {
        setLoading(true);
        setError(null);
        setDownloadProgress(0);
        setStatusText("Resolving document path...");

        console.log(`[PdfViewer] Resolving document URL:`, url);

        // 1. Resolve secure signed or public URL
        const dlUrl = await getPdfDownloadUrl(url);
        if (!active) return;
        setResolvedUrl(dlUrl);

        // 2. Wait for PDF.js engine
        if (!pdfjsLoaded) {
          if (pdfjsLoadError) {
            throw new Error(pdfjsLoadError);
          }
          setStatusText("Preparing PDF engine...");
          return;
        }

        // 3. Cache Storage API integration for instant subsequent loading offline
        const cacheSupported = "caches" in window;
        let pdfBlob: Blob | null = null;

        if (cacheSupported) {
          try {
            const cache = await caches.open("student-pdf-cache");
            const cachedResponse = await cache.match(url);
            if (cachedResponse) {
              console.log(`[PdfViewer Cache] Local hit for:`, url);
              setStatusText("Opening PDF from cached storage...");
              pdfBlob = await cachedResponse.blob();
            }
          } catch (e) {
            console.warn(`[PdfViewer Cache] Error reading cache:`, e);
          }
        }

        // 4. Download file if not cached
        if (!pdfBlob) {
          console.log(`[PdfViewer] Downloading document:`, dlUrl);
          setStatusText("Downloading… 0%");

          pdfBlob = await new Promise<Blob>((resolve, reject) => {
            xhr = new XMLHttpRequest();
            xhr.open("GET", dlUrl, true);
            xhr.responseType = "blob";

            xhr.onprogress = (event) => {
              if (event.lengthComputable && active) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setDownloadProgress(percent);
                setStatusText(`Downloading… ${percent}%`);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
              } else {
                reject(new Error(`Download failed with status: ${xhr.status}`));
              }
            };

            xhr.onerror = () => {
              reject(new Error("Network error occurred during download."));
            };

            xhr.send();
          });

          // Write to local Cache Storage for subsequent instant offline access
          if (cacheSupported && pdfBlob && active) {
            try {
              const cache = await caches.open("student-pdf-cache");
              await cache.put(url, new Response(pdfBlob.slice(0), {
                headers: { "Content-Type": "application/pdf" }
              }));
              console.log(`[PdfViewer Cache] Successfully saved PDF in cache.`);
            } catch (e) {
              console.warn(`[PdfViewer Cache] Failed to write cached file:`, e);
            }
          }
        }

        if (!active) return;
        setStatusText("Preparing document layout...");

        const arrayBuffer = await pdfBlob!.arrayBuffer();
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

        const pdfDoc = await loadingTask.promise;
        if (active) {
          setPdf(pdfDoc);
          setLoading(false);
          console.log(`[PdfViewer] Loaded PDF with ${pdfDoc.numPages} pages.`);
        }
      } catch (err: any) {
        console.error(`[PdfViewer] Loading failed:`, err);
        if (active) {
          const msg = err.message || "";
          if (msg.includes("fetch") || msg.includes("Network") || msg.includes("network")) {
            setError("Network error. Please check your internet connection.");
          } else if (msg.includes("404") || msg.includes("not found")) {
            setError("Document not found.");
          } else if (msg.includes("permission") || msg.includes("403") || msg.includes("unauthorized")) {
            setError("Access denied. Please contact administration.");
          } else if (msg.includes("format") || msg.includes("PDFHeader")) {
            setError("Invalid or corrupted PDF file.");
          } else {
            setError(msg || "Failed to load document.");
          }
          setLoading(false);
        }
      }
    }

    resolveAndLoad();

    return () => {
      active = false;
      if (xhr) {
        xhr.abort();
      }
    };
  }, [pdfjsLoaded, pdfjsLoadError, url, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-900 text-white select-none">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-950 p-4 shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2.5 truncate">
          <FileText className="w-5 h-5 text-blue-400 shrink-0" />
          <h2 className="text-sm font-bold truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pdf && (
            <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1 text-xs font-semibold mr-2 border border-slate-700">
              <button
                onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
                className="hover:text-white text-slate-400 px-1.5 py-0.5 rounded transition cursor-pointer"
                title="Zoom Out"
              >
                -
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                className="hover:text-white text-slate-400 px-1.5 py-0.5 rounded transition cursor-pointer"
                title="Zoom In"
              >
                +
              </button>
            </div>
          )}
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              download={`${title.replace(/\s+/g, "_")}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all border border-slate-700 cursor-pointer"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Viewer Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-800 flex flex-col items-center">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="relative flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <FileText className="absolute w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div className="text-center flex flex-col items-center max-w-sm">
              <p className="font-bold text-sm text-slate-200">{statusText}</p>
              {downloadProgress > 0 && downloadProgress < 100 && (
                <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden mt-3 border border-slate-800">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-2">
                Downloading via direct secure storage channel. File will be cached locally for offline reading.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto gap-4">
            <div className="bg-rose-500/10 p-3 rounded-full border border-rose-500/20 text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-base text-rose-400">{error}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                We encountered an issue opening this chapter notes. Please check your internet connection or use the download button above.
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Download</span>
            </button>
          </div>
        )}

        {!loading && !error && pdf && (
          <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
              transformOrigin: "center top",
              transition: touchStartRef.current ? "none" : "transform 0.1s ease-out",
              touchAction: scale > 1.2 || transform.scale !== 1 ? "none" : "pan-y"
            }}
            className="w-full max-w-3xl flex flex-col gap-2"
          >
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage key={i + 1} pdf={pdf} pageNum={i + 1} scale={scale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
