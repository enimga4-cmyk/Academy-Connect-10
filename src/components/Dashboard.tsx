import React, { useState, useMemo, useEffect } from "react";
import { 
  Users, 
  IndianRupee, 
  BarChart2, 
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Search,
  Phone,
  CheckCircle,
  XCircle,
  MinusCircle,
  FileText,
  Trash2,
  Bell
} from "lucide-react";
import { Student } from "../types";
import { getUnpaidOverdueMonths } from "./StudentList";
import { getInstitutionName, subscribeToAnnouncements, saveAnnouncementDoc, deleteAnnouncementDoc } from "../lib/firestoreService";

interface DashboardProps {
  students: Student[];
  onRefresh: () => void;
  onNavigateToStudents: () => void;
  onNavigateToStudentDetails: (studentId: string) => void;
  onToggleAttendance: (studentId: string, date: string, isPresent: boolean | "na") => void;
}

export default function Dashboard({ 
  students, 
  onRefresh, 
  onNavigateToStudents, 
  onNavigateToStudentDetails,
  onToggleAttendance
}: DashboardProps) {
  const [instName, setInstName] = useState("Ingenious Study Circle");

  useEffect(() => {
    let active = true;
    const loadInstitutionName = async () => {
      const name = await getInstitutionName();
      if (active) setInstName(name);
    };

    loadInstitutionName();
    const handleInstitutionNameUpdate = () => {
      void loadInstitutionName();
    };

    window.addEventListener("institution-name-updated", handleInstitutionNameUpdate);
    return () => {
      active = false;
      window.removeEventListener("institution-name-updated", handleInstitutionNameUpdate);
    };
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adjustingCardId, setAdjustingCardId] = useState<string | null>(null);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [popupSearch, setPopupSearch] = useState("");

  // Announcements/Alerts management
  const [announcements, setAnnouncements] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("tuition_announcements");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [newAnnouncement, setNewAnnouncement] = useState("");

  const handleAddAnnouncement = () => {
    if (!newAnnouncement.trim()) return;
    const item = {
      id: Date.now().toString(),
      text: newAnnouncement.trim(),
      date: new Date().toISOString().slice(0, 10)
    };
    saveAnnouncementDoc(item);
    setNewAnnouncement("");
  };

  const handleDeleteAnnouncement = (id: string) => {
    deleteAnnouncementDoc(id);
  };

  // Sync state in real-time
  useEffect(() => {
    const unsub = subscribeToAnnouncements((list) => {
      setAnnouncements(list);
    });
    return () => {
      unsub();
    };
  }, []);

  // Trigger rotation for refresh
  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  // Calculate statistics dynamically from the true month-by-month state
  const stats = useMemo(() => {
    const totalEnrolled = students.length;
    
    let pendingFeeCount = 0;
    let totalTarget = 0;
    let totalCollected = 0;
    let remainingDue = 0;
    let attendancePresentCount = 0;
    let attendanceMarkedCount = 0;
    let totalCollectedAllMonths = 0;

    students.forEach(student => {
      // 1. Dynamic target fee calculation (for current month July 2026 if they are registered)
      const regDate = student.registrationDate || "2026-06-01";
      const [regYearStr, regMonthStr] = regDate.split("-");
      const regYear = parseInt(regYearStr) || 2026;
      const regMonthIdx = (parseInt(regMonthStr) || 6) - 1; // 0-indexed

      // July 2026 is year 2026, month index 6
      const isEnrolledInJuly = regYear < 2026 || (regYear === 2026 && regMonthIdx <= 6);

      if (isEnrolledInJuly) {
        totalTarget += student.monthlyFee;
        const feeMonths = student.feeMonths || {};
        const status = feeMonths["July 2026"] || (student.feePaidThisMonth ? "paid" : "unpaid");
        if (status === "paid") {
          totalCollected += student.monthlyFee;
        }
      }

      // 2. Overdue calculation using getUnpaidOverdueMonths
      const overdueMonths = getUnpaidOverdueMonths(student);
      if (overdueMonths.length > 0) {
        pendingFeeCount++;
        remainingDue += overdueMonths.length * student.monthlyFee;
      }

      // 3. Attendance calculations for today "2026-07-14"
      const todayStr = "2026-07-14";
      if (student.attendance && student.attendance[todayStr] !== undefined) {
        attendanceMarkedCount++;
        if (student.attendance[todayStr] === true) {
          attendancePresentCount++;
        }
      }

      // 4. Sum up all payments actually made by each student for each month
      const feeMonths = student.feeMonths || {};
      Object.keys(feeMonths).forEach(month => {
        if (feeMonths[month] === "paid") {
          totalCollectedAllMonths += student.monthlyFee;
        }
      });
    });

    // On dashboard total revenue should reflect the total amount I will have after taking sum of all payments made by each student for each month.
    const totalRevenue = totalCollectedAllMonths;
    const collectionPercentage = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;

    return {
      totalEnrolled,
      pendingFeeCount,
      totalRevenue,
      totalTarget,
      totalCollected,
      remainingDue,
      collectionPercentage,
      attendancePresentCount,
      attendanceMarkedCount
    };
  }, [students]);

  // Persistent Card Size state (Supporting: 1x1, 2x1, 3x1, 2x2, 2x3, 1x3, 3x1/2)
  const [cardSizes, setCardSizes] = useState<Record<string, { colSpan: "1" | "2" | "3"; rowSpan: "1/2" | "1" | "2" | "3" }>>(() => {
    const cached = localStorage.getItem("tuition_dashboard_sizes");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Normalize sizes to correct choices
        Object.keys(parsed).forEach(key => {
          if (parsed[key] && parsed[key].colSpan === "1/2") {
            parsed[key].colSpan = "1";
          }
        });
        if (!parsed.attendance) {
          parsed.attendance = { colSpan: "1", rowSpan: "1" };
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return {
      students: { colSpan: "1", rowSpan: "1" },
      pending: { colSpan: "1", rowSpan: "1" },
      revenue: { colSpan: "1", rowSpan: "1" },
      overdue: { colSpan: "1", rowSpan: "1" },
      attendance: { colSpan: "1", rowSpan: "1" },
    };
  });

  // Persistent Card Order state
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const cached = localStorage.getItem("tuition_dashboard_order");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (!parsed.includes("attendance")) {
          parsed.push("attendance");
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return ["students", "pending", "revenue", "overdue", "attendance"];
  });

  // Save layout configurations
  useEffect(() => {
    localStorage.setItem("tuition_dashboard_sizes", JSON.stringify(cardSizes));
  }, [cardSizes]);

  useEffect(() => {
    localStorage.setItem("tuition_dashboard_order", JSON.stringify(cardOrder));
  }, [cardOrder]);

  // Reorder list based on HTML5 drag-and-drop actions
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;
    
    const nextOrder = [...cardOrder];
    const [removed] = nextOrder.splice(draggedIdx, 1);
    nextOrder.splice(targetIndex, 0, removed);
    
    setCardOrder(nextOrder);
    setDraggedIdx(null);
  };

  // Move cards left/right (up/down in order)
  const handleMoveCard = (index: number, direction: "left" | "right") => {
    const nextOrder = [...cardOrder];
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < nextOrder.length) {
      // Swap
      const temp = nextOrder[index];
      nextOrder[index] = nextOrder[targetIdx];
      nextOrder[targetIdx] = temp;
      setCardOrder(nextOrder);
    }
  };

  // Dynamic system date formatter: Tuesday 15/July/2026
  const getFormattedDate = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    const now = new Date();
    const dayName = days[now.getDay()];
    const dayNum = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    
    return `Today is ${dayName} - ${dayNum}/${monthName}/${year}`;
  };

  // Definition of available stats cards
  const cardsConfig = useMemo(() => {
    return {
      students: {
        id: "students",
        title: "Total Students",
        value: stats.totalEnrolled,
        subtext: "View Roster Summary",
        icon: <Users className="w-5 h-5" />,
        theme: "blue" as const,
        onClick: () => {
          setPopupSearch("");
          setActivePopupId("students");
        },
      },
      pending: {
        id: "pending",
        title: "Fees Pending",
        value: stats.pendingFeeCount,
        subtext: "Outstanding Accounts",
        icon: <AlertCircle className="w-5 h-5" />,
        theme: "rose" as const,
        onClick: () => {
          setPopupSearch("");
          setActivePopupId("pending");
        },
      },
      revenue: {
        id: "revenue",
        title: "Total Revenue",
        value: `₹${stats.totalRevenue.toLocaleString("en-IN")}`,
        subtext: "Sum of All Payments",
        icon: <IndianRupee className="w-5 h-5" />,
        theme: "indigo" as const,
        onClick: () => {
          setPopupSearch("");
          setActivePopupId("revenue");
        },
      },
      overdue: {
        id: "overdue",
        title: "Overdue Amount",
        value: `₹${stats.remainingDue.toLocaleString("en-IN")}`,
        subtext: `${stats.pendingFeeCount} Due Accounts`,
        icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
        theme: "amber" as const,
        onClick: () => {
          setPopupSearch("");
          setActivePopupId("overdue");
        },
      },
      attendance: {
        id: "attendance",
        title: "Today's Attendance",
        value: `${stats.attendancePresentCount} / ${stats.totalEnrolled}`,
        subtext: "Click to Record",
        icon: <Calendar className="w-5 h-5" />,
        theme: "emerald" as const,
        onClick: () => {
          setPopupSearch("");
          setActivePopupId("attendance");
        },
      }
    };
  }, [stats]);

  // Filter cardOrder based on state values & Hide Total Revenue if there's no fee entry loaded
  const activeCardIds = useMemo(() => {
    return cardOrder.filter((cardId) => {
      if (cardId === "students") return stats.totalEnrolled > 0;
      if (cardId === "pending") return stats.totalEnrolled > 0;
      if (cardId === "revenue") {
        // Only show total revenue if there is at least one student with a fee entry > 0
        const hasAnyFeeEntry = students.some(s => s.monthlyFee > 0);
        return hasAnyFeeEntry;
      }
      if (cardId === "overdue") return stats.totalEnrolled > 0;
      if (cardId === "attendance") return stats.totalEnrolled > 0;
      return false;
    });
  }, [cardOrder, stats, students]);

  // Dynamic lists filtered for detailed popups
  const popupStudentsList = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(popupSearch.toLowerCase()) || 
      s.classGrade.toLowerCase().includes(popupSearch.toLowerCase())
    );
  }, [students, popupSearch]);

  const pendingStudentsList = useMemo(() => {
    return students.filter(s => {
      const overdue = getUnpaidOverdueMonths(s);
      return overdue.length > 0 && (
        s.name.toLowerCase().includes(popupSearch.toLowerCase()) ||
        s.classGrade.toLowerCase().includes(popupSearch.toLowerCase())
      );
    });
  }, [students, popupSearch]);

  return (
    <div className="flex flex-col gap-6 pb-24 animate-fadeIn" id="dashboard-view">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5" id="dashboard-header">
        <div className="flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100" id="dashboard-title">
            {instName}
          </h1>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5" id="dashboard-subtitle">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            {getFormattedDate()}
          </p>
        </div>
        <button
          onClick={handleRefreshClick}
          className="p-2 sm:p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all focus:outline-hidden cursor-pointer"
          id="btn-refresh-dashboard"
          title="Refresh statistics"
        >
          <RefreshCw 
            className={`w-4 h-4 transition-transform duration-500 ${isRefreshing ? "rotate-180" : ""}`} 
          />
        </button>
      </div>

      {/* Grid: Stats Cards with HTML5 Drag-and-Drop capability */}
      {activeCardIds.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-6 gap-3.5 mt-1" id="stats-grid">
            {activeCardIds.map((cardId, index) => {
              const card = cardsConfig[cardId as keyof typeof cardsConfig];
              if (!card) return null;
              const size = cardSizes[cardId] || { colSpan: "1", rowSpan: "1" };
              
              return (
                <div
                  key={cardId}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="contents"
                >
                  <DashboardCardWrapper
                    card={{...card, ...size}}
                    index={index}
                    totalCards={activeCardIds.length}
                    onLongPress={() => setAdjustingCardId(cardId)}
                    onMoveLeft={() => handleMoveCard(index, "left")}
                    onMoveRight={() => handleMoveCard(index, "right")}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-fadeIn">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-750 dark:text-slate-200">No dashboard metrics available</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs leading-relaxed">
            Enroll your first student or log details in the Students tab to populate dynamic tiles on your ledger.
          </p>
          <button
            onClick={onNavigateToStudents}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            Add Student
          </button>
        </div>
      )}

      {/* Fee Collection Tracker Card */}
      {stats.totalEnrolled > 0 && (
        <div 
          className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-md animate-fadeIn"
          id="card-fee-collection-tracker"
        >
          <div className="flex justify-between items-start" id="fee-tracker-header">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                Monthly fee Collection tracker
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                Target Amount: ₹{stats.totalTarget.toLocaleString("en-IN")} (July 2026 Term)
              </p>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-6 flex justify-between items-end" id="fee-tracker-values">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Collected
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                ₹{stats.totalCollected.toLocaleString("en-IN")}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30">
              {stats.collectionPercentage}% Collected
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full mt-3.5 overflow-hidden" id="fee-tracker-progress-bg">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.collectionPercentage}%` }}
              id="fee-tracker-progress-bar"
            />
          </div>

          <div className="mt-4 flex justify-between items-center text-[11px] font-bold uppercase tracking-wider" id="fee-tracker-footer">
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Overdue Amount: ₹{stats.remainingDue.toLocaleString("en-IN")}</span>
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              Unpaid Students: {stats.pendingFeeCount}
            </span>
          </div>
        </div>
      )}

      {/* Academy Announcements & Alerts Panel (Admin option to post to all students) */}
      <div 
        className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-md animate-fadeIn"
        id="admin-announcements-panel"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Bell className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
              Academy Announcements & Alerts
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Publish critical updates or alerts visible to all student portals
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 items-end">
          <div className="flex-1">
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-3 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-hidden resize-none h-18"
              placeholder="Type announcement or emergency alert text here..."
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              id="admin-dashboard-announcement-input"
            />
          </div>
          <button
            onClick={handleAddAnnouncement}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-md shadow-blue-500/10 cursor-pointer h-18 flex flex-col items-center justify-center gap-1 shrink-0"
          >
            <Bell className="w-4 h-4" />
            <span>Send Alert</span>
          </button>
        </div>

        {announcements.length > 0 && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2.5">Active Announcements ({announcements.length})</p>
            <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
              {announcements.map((ann) => (
                <div key={ann.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{ann.text}</p>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1 block tracking-wider">Posted on {ann.date}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Adjust Tile Size Dialog Modal (Supporting only: 1x1, 2x1, 3x1, 2x2, 2x3, 1x3, 3x1/2) */}
      {adjustingCardId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0" id="adjust-tile-modal">
          <div className="absolute inset-0" onClick={() => setAdjustingCardId(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-slideUp z-10 flex flex-col gap-4 border border-slate-100 dark:border-slate-800 m-0 sm:m-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-850">
              <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-blue-500" />
                Adjust Tile Shape
              </h2>
              <button
                onClick={() => setAdjustingCardId(null)}
                className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 leading-relaxed">
              Customize the shape of the <span className="text-blue-600 dark:text-blue-400">"{cardsConfig[adjustingCardId as keyof typeof cardsConfig]?.title}"</span> block inside the 3-column stats grid.
            </p>

            <div className="grid grid-cols-2 gap-2 my-1 max-h-[350px] overflow-y-auto pr-1">
              {[
                { label: "1x1 Standard Square", col: "1", row: "1" },
                { label: "2x1 Wide Banner", col: "2", row: "1" },
                { label: "3x1 Triple Banner", col: "3", row: "1" },
                { label: "2x2 Expanded Square", col: "2", row: "2" },
                { label: "2x3 Jumbo Tall Block", col: "2", row: "3" },
                { label: "1x3 Extra Tall Column", col: "1", row: "3" },
                { label: "3x1/2 Banner Slider", col: "3", row: "1/2" },
              ].map(({ label, col, row }) => {
                const isSelected = 
                  cardSizes[adjustingCardId]?.colSpan === col && 
                  cardSizes[adjustingCardId]?.rowSpan === row;

                return (
                  <button
                    key={label}
                    onClick={() => {
                      setCardSizes(prev => ({
                        ...prev,
                        [adjustingCardId]: { colSpan: col as any, rowSpan: row as any }
                      }));
                      setAdjustingCardId(null);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col gap-0.5 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/10 text-blue-600 dark:text-blue-400 font-black"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 hover:border-slate-300 dark:hover:border-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-[11px] font-bold">{label}</span>
                    <span className="text-[9px] text-slate-400 font-medium">Span: {col} cols × {row} rows</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setAdjustingCardId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RICH TILE DETAIL POPUP MODAL --- */}
      {activePopupId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center p-0" id="tile-detail-modal">
          <div className="absolute inset-0" onClick={() => setActivePopupId(null)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-slideUp z-10 flex flex-col gap-4 border border-slate-100 dark:border-slate-800 m-0 sm:m-4 max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-850">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  {cardsConfig[activePopupId as keyof typeof cardsConfig]?.icon}
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-850 dark:text-slate-100">
                    {cardsConfig[activePopupId as keyof typeof cardsConfig]?.title} Details
                  </h2>
                  <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
                    Active Registry Audit View
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActivePopupId(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Searchbar inside popup */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search matching students..."
                value={popupSearch}
                onChange={(e) => popupSearch !== undefined && setPopupSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Modal Content Scroll viewport */}
            <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-3 min-h-[250px] max-h-[450px]">
              
              {/* POPUP 1: Total Students */}
              {activePopupId === "students" && (
                <div className="flex flex-col gap-2.5">
                  {popupStudentsList.length > 0 ? (
                    popupStudentsList.map(s => (
                      <div 
                        key={s.id}
                        onClick={() => {
                          setActivePopupId(null);
                          onNavigateToStudentDetails(s.id);
                        }}
                        className="p-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 rounded-xl flex items-center justify-between hover:border-blue-400/50 cursor-pointer transition-all hover:bg-slate-100/50"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">{s.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Grade: {s.classGrade} • Enrolled: {s.enrolledSubjects?.join(", ")}</span>
                        </div>
                        <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          Fee: ₹{s.monthlyFee}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs font-semibold">No students matching search</div>
                  )}
                </div>
              )}

              {/* POPUP 2 & 4: Fees Pending / Overdue Amount */}
              {(activePopupId === "pending" || activePopupId === "overdue") && (
                <div className="flex flex-col gap-2.5">
                  {pendingStudentsList.length > 0 ? (
                    pendingStudentsList.map(s => {
                      const overdueMonths = getUnpaidOverdueMonths(s);
                      const totalDue = overdueMonths.length * s.monthlyFee;
                      return (
                        <div 
                          key={s.id}
                          className="p-3.5 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100/30 dark:border-rose-900/20 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">{s.name}</span>
                            <span className="text-[10px] text-rose-600 font-semibold mt-0.5">Overdue: {overdueMonths.join(", ")}</span>
                            <span className="text-[9px] text-slate-400 mt-0.5">Contact: {s.phone} (Parent: {s.parentPhone || "None"})</span>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400">₹{totalDue}</span>
                            <button
                              onClick={() => {
                                setActivePopupId(null);
                                onNavigateToStudentDetails(s.id);
                              }}
                              className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Open Ledger
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs font-semibold">No pending fee payments.</div>
                  )}
                </div>
              )}

              {/* POPUP 3: Total Revenue Breakdown */}
              {activePopupId === "revenue" && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                    Session Payment Cycles Sheet (March 2026 - March 2027)
                  </span>
                  
                  {[
                    "March 2026", "April 2026", "May 2026", "June 2026", 
                    "July 2026", "August 2026", "September 2026", "October 2026", 
                    "November 2026", "December 2026", "January 2027", "February 2027", "March 2027"
                  ].map(month => {
                    let monthTotal = 0;
                    const paidStudents: string[] = [];

                    students.forEach(s => {
                      const status = s.feeMonths?.[month];
                      if (status === "paid") {
                        monthTotal += s.monthlyFee;
                        paidStudents.push(s.name);
                      }
                    });

                    if (monthTotal === 0) return null;

                    return (
                      <div 
                        key={month}
                        className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-center border-b border-dashed border-slate-200 dark:border-slate-850 pb-1.5">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">{month}</span>
                          <span className="text-xs font-black text-emerald-600">₹{monthTotal} Collected</span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                          Paid by: {paidStudents.length > 0 ? paidStudents.join(", ") : "None yet"}
                        </p>
                      </div>
                    );
                  })}

                  <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/30 rounded-xl text-center">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cumulative Total Collected</span>
                    <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">₹{stats.totalRevenue}</h3>
                  </div>
                </div>
              )}

              {/* POPUP 5: Today's Attendance Checklist (July 14) */}
              {activePopupId === "attendance" && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>Active Date: 14 July 2026</span>
                    <span className="text-emerald-600">{stats.attendancePresentCount} Present today</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {popupStudentsList.length > 0 ? (
                      popupStudentsList.map(s => {
                        const att = s.attendance?.["2026-07-14"];
                        return (
                          <div 
                            key={s.id}
                            className="p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 rounded-xl flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200">{s.name}</span>
                              <span className="text-[10px] text-slate-400">Class {s.classGrade}</span>
                            </div>

                            {/* Present/Absent/NA Toggle Buttons */}
                            <div className="flex gap-1">
                              <button
                                onClick={() => onToggleAttendance(s.id, "2026-07-14", true)}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${
                                  att === true 
                                    ? "bg-emerald-600 text-white" 
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
                                }`}
                              >
                                Present
                              </button>
                              <button
                                onClick={() => onToggleAttendance(s.id, "2026-07-14", false)}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${
                                  att === false 
                                    ? "bg-rose-600 text-white" 
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
                                }`}
                              >
                                Absent
                              </button>
                              <button
                                onClick={() => onToggleAttendance(s.id, "2026-07-14", "na")}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${
                                  att === "na" 
                                    ? "bg-slate-400 text-white" 
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-xs">No students matching search</div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
              <button
                onClick={() => setActivePopupId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close Summary
              </button>
              <button
                onClick={() => {
                  setActivePopupId(null);
                  onNavigateToStudents();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Manage Students Tab
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Stats Card Wrapper with long-press gesture support
interface CardItem {
  id: string;
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  theme: "blue" | "rose" | "indigo" | "amber" | "emerald";
  colSpan: "1" | "2" | "3";
  rowSpan: "1/2" | "1" | "2" | "3";
  onClick?: () => void;
}

interface CardWrapperProps {
  card: CardItem;
  index: number;
  totalCards: number;
  onLongPress: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}

const DashboardCardWrapper: React.FC<CardWrapperProps> = ({
  card,
  index,
  totalCards,
  onLongPress,
  onMoveLeft,
  onMoveRight
}) => {
  const timerRef = React.useRef<any>(null);
  const [isLongPressTriggered, setIsLongPressTriggered] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    setIsPressing(true);
    setIsLongPressTriggered(false);
    timerRef.current = setTimeout(() => {
      onLongPress();
      setIsLongPressTriggered(true);
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 600); // 600ms hold
  };

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsPressing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (card.onClick) {
      card.onClick();
    }
  };

  const themeClasses = {
    blue: "bg-gradient-to-br from-blue-600 to-sky-500 text-white border-blue-500/15 shadow-md",
    rose: "bg-gradient-to-br from-red-600 to-rose-500 text-white border-red-500/15 shadow-md",
    indigo: "bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-sm",
    amber: "bg-gradient-to-br from-amber-500 to-yellow-400 text-slate-900 border-yellow-500/15 shadow-md",
    emerald: "bg-gradient-to-br from-emerald-600 to-teal-500 text-white border-emerald-500/15 shadow-md",
  };

  const colSpanToGridClass: Record<string, string> = {
    "1": "col-span-2",
    "2": "col-span-4",
    "3": "col-span-6"
  };

  const rowSpanToGridClass: Record<string, string> = {
    "1/2": "row-span-1 h-[68px] min-h-[68px]",
    "1": "row-span-2 h-[128px] min-h-[128px]",
    "2": "row-span-4 h-[258px] min-h-[258px]",
    "3": "row-span-6 h-[388px] min-h-[388px]"
  };

  const colClass = colSpanToGridClass[String(card.colSpan)] || "col-span-2";
  const rowClass = rowSpanToGridClass[String(card.rowSpan)] || "row-span-2 h-[128px]";
  const spanClasses = `${colClass} ${rowClass}`;

  const isHalfRow = String(card.rowSpan) === "1/2";

  if (isHalfRow) {
    return (
      <div
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onClick={handleClick}
        className={`relative p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer select-none group overflow-hidden ${
          themeClasses[card.theme]
        } ${spanClasses} ${isPressing ? "scale-97 brightness-95" : "hover:scale-[1.015] hover:shadow-xs"}`}
      >
        <div className="flex items-center gap-2 max-w-[70%]">
          <div className={`p-1 rounded-lg shrink-0 ${
            card.theme === "indigo" ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200" : "bg-white/15 text-white"
          }`}>
            {React.isValidElement(card.icon) ? React.cloneElement(card.icon, { className: "w-3.5 h-3.5" } as React.HTMLAttributes<HTMLElement>) : null}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[9px] font-black uppercase tracking-wider leading-tight text-wrap break-words ${
              card.theme === "indigo" ? "text-slate-400 dark:text-slate-500" : card.theme === "amber" ? "text-slate-800" : "text-blue-50/90"
            }`}>
              {card.title}
            </span>
            <p className={`text-[8px] font-bold uppercase tracking-wider leading-tight text-wrap break-words ${
              card.theme === "indigo" ? "text-blue-600 dark:text-blue-400" : card.theme === "amber" ? "text-amber-950" : "text-blue-100/75"
            }`}>
              {card.subtext}
            </p>
          </div>
        </div>
        <span className="font-black tracking-tight shrink-0 text-xs">
          {card.value}
        </span>
      </div>
    );
  }

  // Value Font Sizing depending on card size
  let valFontSize = "text-xl sm:text-2xl";
  if (card.rowSpan === "3") {
    valFontSize = "text-4xl sm:text-5xl";
  } else if (card.rowSpan === "2") {
    valFontSize = "text-3xl sm:text-4xl";
  }

  return (
    <div
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onClick={handleClick}
      className={`relative p-4 rounded-2xl border shadow-sm transition-all duration-300 flex flex-col justify-between cursor-pointer select-none group overflow-hidden ${
        themeClasses[card.theme]
      } ${spanClasses} ${isPressing ? "scale-97 brightness-95" : "hover:scale-[1.015] hover:shadow-md"}`}
    >
      {/* Small top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 transition-opacity opacity-0 group-hover:opacity-100 ${
        card.theme === 'indigo' ? 'bg-blue-500' : 'bg-white/40'
      }`} />

      {/* Card Header */}
      <div className="flex justify-between items-start gap-1">
        <span className={`font-extrabold uppercase tracking-widest text-[10px] leading-tight text-wrap break-words ${
          card.theme === "indigo" ? "text-slate-400 dark:text-slate-500" : card.theme === "amber" ? "text-amber-950/80" : "text-blue-50/90"
        }`}>
          {card.title}
        </span>
        <div className={`p-1.5 rounded-lg shrink-0 ${
          card.theme === "indigo" ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200" : "bg-white/15 text-white"
        }`}>
          {card.icon}
        </div>
      </div>

      {/* Card Body */}
      <div className="mt-2">
        <span className={`font-black tracking-tight leading-none text-wrap break-all ${valFontSize}`}>
          {card.value}
        </span>
        <p className={`font-extrabold uppercase tracking-wider mt-1 flex items-center gap-1 text-[9px] leading-tight text-wrap break-words ${
          card.theme === "indigo" ? "text-blue-600 dark:text-blue-400" : card.theme === "amber" ? "text-amber-950" : "text-white/80"
        }`}>
          <span className="text-wrap break-words">{card.subtext}</span>
          <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
        </p>
      </div>

      {/* Control overlay when hovered or held */}
      <div className="mt-2 pt-2 border-t border-slate-150/10 dark:border-slate-850/10 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Resize control */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLongPress();
          }}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all ${
            card.theme === "indigo" 
              ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400" 
              : "bg-white/15 hover:bg-white/25 text-white"
          }`}
          title="Change size (or hold card)"
        >
          {card.colSpan}x{card.rowSpan}
        </button>

        {/* Position Controls */}
        <div className="flex gap-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft();
            }}
            className={`p-1 rounded transition-all ${
              index === 0 
                ? "opacity-25 cursor-not-allowed" 
                : card.theme === "indigo" 
                  ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400" 
                  : "bg-white/15 hover:bg-white/25 text-white"
            }`}
            title="Move earlier"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={index === totalCards - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight();
            }}
            className={`p-1 rounded transition-all ${
              index === totalCards - 1 
                ? "opacity-25 cursor-not-allowed" 
                : card.theme === "indigo" 
                  ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400" 
                  : "bg-white/15 hover:bg-white/25 text-white"
            }`}
            title="Move later"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
