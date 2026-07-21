import { jsPDF } from "jspdf";
import { Student } from "../types";

// Generate a list of the 13 months for a March-to-March session
export function getSessionMonths(startYear: number): string[] {
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const months: string[] = [];
  
  // March to December of startYear
  for (let m = 2; m < 12; m++) {
    months.push(`${monthNames[m]} ${startYear}`);
  }
  // January to March of next year
  for (let m = 0; m <= 2; m++) {
    months.push(`${monthNames[m]} ${startYear + 1}`);
  }
  
  return months;
}

// Check if a specific month is overdue based on current time
// Overdue if unpaid after 3rd of the next month at 1:00 PM
export function isMonthOverdue(monthYearStr: string, currentDateTime: Date = new Date()): boolean {
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const [monthName, yearStr] = monthYearStr.split(" ");
  const monthIndex = monthNames.indexOf(monthName);
  const year = parseInt(yearStr);
  
  if (monthIndex === -1 || isNaN(year)) return false;
  
  let nextMonthIdx = monthIndex + 1;
  let nextMonthYear = year;
  if (nextMonthIdx > 11) {
    nextMonthIdx = 0;
    nextMonthYear = year + 1;
  }
  
  // Deadline is 3rd of next month at 1:00 PM
  const deadline = new Date(nextMonthYear, nextMonthIdx, 3, 13, 0, 0);
  return currentDateTime > deadline;
}

// Formats date string from input type date "YYYY-MM-DD" to "DD/MM/YYYY"
export function formatDisplayDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  if (dateStr.includes("/")) return dateStr; // already formatted
  
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

// Generate the Annual PDF report
export function generateAnnualReport(startYear: number, students: Student[]) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const sessionMonths = getSessionMonths(startYear);
  const sessionLabel = `March ${startYear} - March ${startYear + 1}`;
  
  let totalRevenue = 0;
  let totalDues = 0;
  let totalRegisteredStudents = 0;
  
  interface StudentDueItem {
    name: string;
    classGrade: string;
    dueMonths: string[];
    totalDueAmount: number;
    phone: string;
  }
  
  const dueList: StudentDueItem[] = [];

  students.forEach((student) => {
    const regDate = student.registrationDate || "2026-06-01";
    let regYear = 2026;
    let regMonthIdx = 5; // June (0-indexed)

    if (regDate.includes("/")) {
      const parts = regDate.split("/");
      if (parts.length === 3) {
        regYear = parseInt(parts[2]) || 2026;
        regMonthIdx = (parseInt(parts[1]) || 6) - 1;
      }
    } else {
      const parts = regDate.split("-");
      if (parts.length === 3) {
        regYear = parseInt(parts[0]) || 2026;
        regMonthIdx = (parseInt(parts[1]) || 6) - 1;
      }
    }

    const feeMonths = student.feeMonths || {};
    const studentDueMonths: string[] = [];
    let studentRevenue = 0;
    let studentDues = 0;
    let isEnrolledInSession = false;

    sessionMonths.forEach((monthStr) => {
      const [mName, yStr] = monthStr.split(" ");
      const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
      ];
      const mIdx = monthNames.indexOf(mName);
      const year = parseInt(yStr) || startYear;

      // Check enrollment boundary
      const isBeforeRegistration = year < regYear || (year === regYear && mIdx < regMonthIdx);
      
      if (!isBeforeRegistration) {
        isEnrolledInSession = true;
        const status = feeMonths[monthStr];
        
        if (status === "paid") {
          studentRevenue += student.monthlyFee;
        } else if (status === "unpaid" || !status) {
          // If unpaid and overdue
          if (isMonthOverdue(monthStr)) {
            studentDues += student.monthlyFee;
            studentDueMonths.push(mName); // Just store month name for compact display
          }
        }
      }
    });

    if (isEnrolledInSession) {
      totalRegisteredStudents++;
      totalRevenue += studentRevenue;
      totalDues += studentDues;
      
      if (studentDueMonths.length > 0) {
        dueList.push({
          name: student.name,
          classGrade: student.classGrade,
          dueMonths: studentDueMonths,
          totalDueAmount: studentDues,
          phone: student.phone
        });
      }
    }
  });

  // --- PDF Styling & Layout Constants ---
  const primaryColor = [37, 99, 235]; // Blue 600
  const secondaryColor = [30, 41, 59]; // Slate 800
  const lightBg = [248, 250, 252]; // Slate 50
  const redColor = [220, 38, 38]; // Red 600
  
  // Page Border / Header Accent
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 6, "F");

  // Title & Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("INGENIOUS STUDY CIRCLE", 15, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text("Annual Financial & Ledger Audit Report", 15, 25);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 155, 20);

  // Line Divider
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(15, 29, 195, 29);

  // Financial Session Metadata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("AUDIT SESSION INFORMATION", 15, 38);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Session Period: ${sessionLabel}`, 15, 44);
  doc.text(`Active Roster Count in Session: ${totalRegisteredStudents} Students`, 15, 49);

  // --- STATS KPI CARDS ---
  const cardY = 57;
  const cardW = 56;
  const cardH = 26;
  
  // Total Revenue Collected
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, cardY, cardW, cardH, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, cardY, cardW, cardH, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL REVENUE COLLECTED", 20, cardY + 7);
  doc.setFontSize(15);
  doc.setTextColor(34, 197, 94); // Green 500
  doc.text(`INR ${totalRevenue.toLocaleString("en-IN")}`, 20, cardY + 17);

  // Total Outstanding Dues
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15 + cardW + 8, cardY, cardW, cardH, 3, 3, "F");
  doc.setDrawColor(254, 226, 226); // Rose 100
  doc.roundedRect(15 + cardW + 8, cardY, cardW, cardH, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL PAYMENT DUES", 20 + cardW + 8, cardY + 7);
  doc.setFontSize(15);
  doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  doc.text(`INR ${totalDues.toLocaleString("en-IN")}`, 20 + cardW + 8, cardY + 17);

  // Collection Rate
  const rate = totalRevenue + totalDues > 0 ? Math.round((totalRevenue / (totalRevenue + totalDues)) * 100) : 100;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15 + (cardW * 2) + 16, cardY, cardW, cardH, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15 + (cardW * 2) + 16, cardY, cardW, cardH, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("COLLECTION EFFICIENCY", 20 + (cardW * 2) + 16, cardY + 7);
  doc.setFontSize(15);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${rate}%`, 20 + (cardW * 2) + 16, cardY + 17);

  // --- OUTSTANDING DUES TABLE ---
  let nextY = cardY + cardH + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("STUDENTS OUTSTANDING DUE SUMMARY", 15, nextY);

  nextY += 6;
  // Draw Table Headers
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(15, nextY, 180, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("STUDENT NAME", 18, nextY + 5.5);
  doc.text("CLASS", 65, nextY + 5.5);
  doc.text("DUE MONTHS", 95, nextY + 5.5);
  doc.text("AMOUNT DUE", 165, nextY + 5.5);

  nextY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85); // Slate 700

  if (dueList.length === 0) {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(15, nextY, 180, 15, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, nextY, 180, 15, "S");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 197, 94);
    doc.text("All students are fully paid up for this financial year session!", 48, nextY + 9);
  } else {
    dueList.forEach((item, idx) => {
      // Row background zebra stripe
      if (idx % 2 === 1) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(15, nextY, 180, 10, "F");
      }
      
      doc.setDrawColor(241, 245, 249);
      doc.line(15, nextY + 10, 195, nextY + 10);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(item.name.substring(0, 24), 18, nextY + 6.5);
      
      doc.setFont("helvetica", "normal");
      doc.text(item.classGrade, 65, nextY + 6.5);
      
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const monthsStr = item.dueMonths.join(", ");
      const truncatedMonths = monthsStr.length > 36 ? monthsStr.substring(0, 34) + "..." : monthsStr;
      doc.text(truncatedMonths, 95, nextY + 6.5);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(redColor[0], redColor[1], redColor[2]);
      doc.text(`INR ${item.totalDueAmount.toLocaleString("en-IN")}`, 165, nextY + 6.5);
      
      nextY += 10;
    });
  }

  // Draw Bottom signature & Beautiful Calligraphy branding
  const footerY = 268;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, footerY - 5, 195, footerY - 5);

  doc.setFont("times", "italic");
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("Designed by Sumit", 15, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text("— POWERED BY ANDROID —", 15, footerY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const instName = localStorage.getItem("tuition_institution_name") || "Ingenious Study Circle";
  doc.text(`Official Audit Ledger Document • ${instName} Management Hub`, 100, footerY + 2);

  // Download PDF with robust sandboxed iframe fallbacks
  const fileName = `Tuition_Ledger_Report_${startYear}_${startYear + 1}.pdf`;
  try {
    doc.save(fileName);
  } catch (error) {
    console.warn("[PDF Generator] Standard doc.save failed, trying Blob download fallback:", error);
    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[PDF Generator] Blob fallback failed:", e);
      // Final fallback: open data uri in new tab or frame
      try {
        const string = doc.output("datauristring");
        const x = window.open();
        if (x) {
          x.document.open();
          x.document.write(`<iframe width='100%' height='100%' style='border:0' src='${string}'></iframe>`);
          x.document.close();
        } else {
          window.location.href = string;
        }
      } catch (err) {
        console.error("[PDF Generator] All fallback attempts failed:", err);
      }
    }
  }
}
