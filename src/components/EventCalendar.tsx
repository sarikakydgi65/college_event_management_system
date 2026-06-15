import React, { useState } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Star, 
  User, 
  GraduationCap,
  X
} from "lucide-react";

interface EventCalendarProps {
  events: any[];
  onRegister: (eventId: number) => Promise<void>;
  onCancel: (eventId: number) => Promise<void>;
  getOverlappingEnrolledEvent: (ev: any) => any | null;
}

export default function EventCalendar({ 
  events, 
  onRegister, 
  onCancel, 
  getOverlappingEnrolledEvent 
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 4, 25)); // Initialize near May 2026 where default events sit
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Helper: Department color map helper
  const getEventDeptColor = (ev: any) => {
    const name = (ev.event_name || "").toLowerCase();
    const role = (ev.organizer_role || "").toLowerCase();
    const desc = (ev.description || "").toLowerCase();

    if (name.includes("tech") || role.includes("cs") || name.includes("code") || name.includes("hackathon") || name.includes("cyber") || name.includes("programming")) {
      return {
        bg: "bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-750",
        dot: "bg-blue-500",
        label: "Computer Science",
        text: "text-blue-700",
        ring: "focus:ring-blue-400"
      };
    }
    if (name.includes("art") || name.includes("culture") || name.includes("music") || desc.includes("painting") || desc.includes("heritage")) {
      return {
        bg: "bg-purple-50 hover:bg-purple-100/80 border-purple-200 text-purple-750",
        dot: "bg-purple-500",
        label: "Art & Culture",
        text: "text-purple-700",
        ring: "focus:ring-purple-400"
      };
    }
    if (name.includes("ai") || name.includes("robot") || name.includes("machine learning") || desc.includes("generative")) {
      return {
        bg: "bg-teal-50 hover:bg-teal-100/80 border-teal-200 text-teal-750",
        dot: "bg-teal-500",
        label: "AI & Robotics",
        text: "text-teal-700",
        ring: "focus:ring-teal-400"
      };
    }
    if (name.includes("orientation") || name.includes("fresh") || name.includes("welcome") || desc.includes("orientation")) {
      return {
        bg: "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-750",
        dot: "bg-amber-500",
        label: "Orientation",
        text: "text-amber-700",
        ring: "focus:ring-amber-400"
      };
    }
    return {
      bg: "bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-750",
      dot: "bg-slate-500",
      label: "General Seminar",
      text: "text-slate-700",
      ring: "focus:ring-slate-400"
    };
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get Calendar details
  const firstDayOfMonthIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  // Days array to populate grid
  const days: { dayNumber: number; dateString: string; isCurrentMonth: boolean }[] = [];

  // Previous month dates padding
  for (let i = firstDayOfMonthIndex - 1; i >= 0; i--) {
    const prevDay = totalDaysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, prevDay);
    const dateStr = prevMonthDate.toISOString().split("T")[0];
    days.push({
      dayNumber: prevDay,
      dateString: dateStr,
      isCurrentMonth: false
    });
  }

  // Current month dates
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;
    days.push({
      dayNumber: d,
      dateString: dateStr,
      isCurrentMonth: true
    });
  }

  // Next month padding to fill grid to multiple of 7
  const totalGridCellsNeeded = Math.ceil(days.length / 7) * 7;
  const paddingNextDays = totalGridCellsNeeded - days.length;
  for (let n = 1; n <= paddingNextDays; n++) {
    const nextMonthDate = new Date(year, month + 1, n);
    const dateStr = nextMonthDate.toISOString().split("T")[0];
    days.push({
      dayNumber: n,
      dateString: dateStr,
      isCurrentMonth: false
    });
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div id="student-calendar-view" className="space-y-4 font-sans antialiased">
      {/* Legend and Navigation Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 p-4 border border-slate-200/60 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 hover:bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-800 font-mono tracking-wide min-w-[130px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 hover:bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg transition-all ml-1 cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Dynamic color code guidelines */}
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono text-slate-500 font-bold select-none uppercase tracking-wider">
          <span className="flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 border border-blue-200 text-blue-700 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> CS & Code
          </span>
          <span className="flex items-center gap-1.5 bg-teal-50 px-2 py-0.5 border border-teal-200 text-teal-700 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> AI & Robotics
          </span>
          <span className="flex items-center gap-1.5 bg-purple-50 px-2 py-0.5 border border-purple-200 text-purple-700 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Art & Culture
          </span>
          <span className="flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 border border-amber-200 text-amber-700 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Orientation
          </span>
          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 border border-slate-200 text-slate-600 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Gen Seminar
          </span>
        </div>
      </div>

      {/* Calendar Grid Box */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Week Days Headers */}
        <div className="grid grid-cols-7 border-b border-slate-150 bg-slate-50/50">
          {weekdays.map((wd) => (
            <div 
              key={wd} 
              className="py-2.5 text-center text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 border-r border-slate-150 last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Days Cellular Layout */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-150 border-t border-slate-150 -mt-px select-none">
          {days.map((day, idx) => {
            const dayEvents = events.filter((e) => e.event_date === day.dateString);
            const isToday = day.dateString === todayStr;

            return (
              <div
                key={`${day.dateString}-${idx}`}
                className={`min-h-[90px] md:min-h-[110px] p-1.5 flex flex-col justify-between transition-all hover:bg-slate-50/30 overflow-hidden relative ${
                  day.isCurrentMonth ? "bg-white" : "bg-slate-50/40 text-slate-350"
                }`}
              >
                {/* Cell date header */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday 
                      ? "bg-blue-600 text-white shadow-xs font-black" 
                      : day.isCurrentMonth ? "text-slate-800" : "text-slate-400"
                  }`}>
                    {day.dayNumber}
                  </span>
                  
                  {dayEvents.length > 0 && (
                    <span className="text-[9px] font-bold text-slate-450 font-mono scale-90">
                      {dayEvents.length} Event{dayEvents.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Day events mapping indicator */}
                <div className="flex-1 mt-1.5 space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
                  {dayEvents.map((ev) => {
                    const style = getEventDeptColor(ev);
                    return (
                      <button
                        key={`grid-badge-${ev.event_id}`}
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left p-1 text-[9px] font-semibold border rounded-md transition-all truncate flex items-center gap-1 cursor-pointer hover:shadow-2xs ${style.bg}`}
                      >
                        <span className={`w-1 h-1 shrink-0 rounded-full ${style.dot}`} />
                        <span className="truncate flex-1 font-sans leading-none">{ev.event_name}</span>
                        {ev.registered && (
                          <span className="text-[8px] bg-emerald-500 text-white rounded-full px-0.5 shrink-0 scale-90">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL / SECTOR DRAWER BOX DETAILED POPUP */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 shadow-2xl animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Pop Header */}
            <div className="bg-slate-50/90 border-b border-slate-150 px-5 py-4 flex items-center justify-between">
              <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                getEventDeptColor(selectedEvent).bg
              }`}>
                {getEventDeptColor(selectedEvent).label}
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-150 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Details container */}
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-slate-400">SEMINAR #EE-{selectedEvent.event_id}</p>
                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  {selectedEvent.event_name}
                </h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                {selectedEvent.description || "No customized details reported for this university program showcase yet."}
              </p>

              {/* Attributes block */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono text-xs text-slate-650">
                <p className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{selectedEvent.event_date}</span>
                </p>
                <p className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{selectedEvent.venue}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{selectedEvent.booking?.start_time || "09:30 AM"} - {selectedEvent.booking?.end_time || "12:30 PM"}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Cap: {selectedEvent.registrations_count || 0}/{selectedEvent.max_capacity}</span>
                </p>
              </div>

              {/* Coordinator Metadata Info */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-150 bg-slate-50/50 text-[11px] leading-snug text-slate-500">
                <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-slate-800 font-bold">{selectedEvent.organizer_name}</p>
                  <p className="text-[10px] text-slate-500">{selectedEvent.organizer_role || "Associate CSE Speaker"}</p>
                </div>
              </div>

              {/* Schedule Conflict block indicator */}
              {(() => {
                const conflict = getOverlappingEnrolledEvent(selectedEvent);
                if (conflict && !selectedEvent.registered) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 text-amber-850 p-2.5 rounded-xl font-mono text-[10px] leading-relaxed flex items-start gap-1.5 shadow-sm">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <strong>Overlay Conflict!</strong> This overlaps with registered class: <strong className="text-amber-900">"{conflict.event_name}"</strong>. Space allocation is constrained!
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Actions panel */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-150 flex items-center justify-between gap-3">
              <div className="text-xs">
                {selectedEvent.registered ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Booked & Secured
                  </span>
                ) : (
                  <span className="text-slate-500">Re-allocation open</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedEvent.registered ? (
                  <button
                    onClick={async () => {
                      await onCancel(selectedEvent.event_id);
                      setSelectedEvent(null);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    Stop Seat
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await onRegister(selectedEvent.event_id);
                      setSelectedEvent(null);
                    }}
                    disabled={
                      selectedEvent.registrations_count >= selectedEvent.max_capacity || 
                      !!getOverlappingEnrolledEvent(selectedEvent)
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                      selectedEvent.registrations_count >= selectedEvent.max_capacity
                        ? "bg-slate-150 text-slate-400 border border-slate-200 cursor-not-allowed"
                        : getOverlappingEnrolledEvent(selectedEvent)
                          ? "bg-amber-100/80 text-amber-700 border border-amber-200 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white border border-blue-700"
                    }`}
                  >
                    {selectedEvent.registrations_count >= selectedEvent.max_capacity 
                      ? "Fully Booked" 
                      : getOverlappingEnrolledEvent(selectedEvent) 
                        ? "Overlap Conflict" 
                        : "Reserve Seat"}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
