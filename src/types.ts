export interface ChapterNote {
  id: string;
  chapterNo: number; // Only number!
  chapterName: string; // Chapter name
  pdfUrl: string; // Base64 PDF content
  pdfFileName: string; // Original PDF filename
  isCompleted?: boolean; // For tracking revision progress
  remark?: string; // Specific tutor remark on student's performance/difficulty
  createdAt: string;

  // Supabase storage metadata
  storageProvider?: "supabase";
  bucket?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  downloadUrl?: string;
}

export interface StudentReport {
  id: string;
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

export interface Student {
  id: string;
  uid?: string; // Firebase Auth UID for deleting account
  name: string;
  classGrade: string; // "Class 8", "Class 9", "Class 10"
  phone: string;
  parentPhone: string;
  monthlyFee: number;
  feePaidThisMonth: boolean; // Legacy fallback
  registrationDate?: string; // YYYY-MM-DD joining date
  feeMonths?: Record<string, "paid" | "unpaid" | "na">; // e.g. {"June 2026": "unpaid", "July 2026": "paid"}
  feeMonthsList?: string[]; // e.g. ["March 2026", "April 2026"]
  feePaymentDates?: Record<string, string>; // e.g. {"June 2026": "2026-06-15"}
  enrolledSubjects: string[]; // e.g. ["Computer Science", "English", "Mathematics", "Science"]
  avatarUrl?: string; // custom image url
  avatarColor?: string; // fallback background color
  avatarStorageProvider?: "supabase";
  avatarBucket?: string;
  avatarStoragePath?: string;
  notes: Record<string, ChapterNote[]>; // subject -> list of pdf notes
  attendance: Record<string, boolean | "na">; // date (YYYY-MM-DD) -> present (true), absent (false), or N/A ("na")
  email?: string;
  password?: string;
  reports?: StudentReport[];
}

export interface TuitionStats {
  totalEnrolled: number;
  presentToday: number;
  activeClassesCount: number;
  feesPendingCount: number;
  totalRevenue: number;
  monthlyTarget: number;
  monthlyCollected: number;
  subjectProgress: Record<string, number>; // subject -> progress %
}
