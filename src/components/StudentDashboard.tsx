import React, { useState, useEffect } from "react";
import { Calendar, FileText, CheckCircle, Clock, Star, MapPin, Compass, AlertCircle, Sparkles, Send, Trash2, ShieldAlert, Award, Bell, Download, RefreshCw, Mail, Search, Lock } from "lucide-react";
import { Student } from "../types";
import { jsPDF } from "jspdf";
import EventCalendar from "./EventCalendar";

interface StudentDashboardProps {
  student: Student;
  onLogout: () => void;
}

export default function StudentDashboard({ student, onLogout }: StudentDashboardProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [feedbackEvent, setFeedbackEvent] = useState<any | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comments, setComments] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [catalogView, setCatalogView] = useState<"grid" | "calendar">("grid");

  const fetchStudentEvents = async () => {
    try {
      const response = await fetch(`/api/student/${student.student_id}/events`);
      if (!response.ok) throw new Error("Failed to load events data");
      const data = await response.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong loading events.");
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/notifications/${student.student_id}/student`);
      if (response.ok) {
        const list = await response.json();
        setNotifications(list);
      }
    } catch (err) {
      // Quietly suppress transient polling errors
    }
  };

  useEffect(() => {
    fetchStudentEvents();
    fetchNotifications();
    
    // Poll notifications every 4 seconds for immediate responsiveness
    const timer = setInterval(() => {
      fetchNotifications();
    }, 4500);

    return () => clearInterval(timer);
  }, [student.student_id]);

  const handleRegister = async (eventId: number) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id, event_id: eventId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Constraint check failed");
      }
      setSuccessMsg("Success! Seat secured and registered in system ledger.");
      fetchStudentEvents();
      fetchNotifications();
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    }
  };

  const handleCancelRegistration = async (eventId: number) => {
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/registrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id, event_id: eventId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "De-registration failed");
      }
      setSuccessMsg("Registration successfully cancelled. Re-allocated classroom spaces freed.");
      fetchStudentEvents();
      fetchNotifications();
    } catch (err: any) {
      setError(err.message || "Failed to cancel registration.");
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackEvent) return;
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          event_id: feedbackEvent.event_id,
          rating,
          comments
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Duplicate feedback not allowed");
      }

      setSuccessMsg(`Thank you! Your ratings (${rating}/5 stars) are registered securely.`);
      setFeedbackEvent(null);
      setComments("");
      setRating(5);
      fetchStudentEvents();
    } catch (err: any) {
      setError(err.message || "Failure registering feedback.");
    } finally {
      setIsLoading(false);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: student.student_id })
      });
      if (response.ok) {
        fetchNotifications();
      }
    } catch (err) {
      // Quietly handle read notification errors
    }
  };

  const downloadCertificate = (studentName: string, eventName: string, eventDate: string, venue: string, organizerName: string) => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const w = 297;
      const h = 210;

      // Cream Diploma Tint Background
      doc.setFillColor(254, 253, 250);
      doc.rect(0, 0, w, h, "F");

      // Slate Border frame
      doc.setDrawColor(15, 23, 42); 
      doc.setLineWidth(1.8);
      doc.rect(12, 12, w - 24, h - 24);

      // Gold styling inner border line
      doc.setDrawColor(217, 119, 6); 
      doc.setLineWidth(0.6);
      doc.rect(15, 15, w - 30, h - 30);

      // Corner gold medallions
      doc.setFillColor(217, 119, 6);
      doc.rect(14, 14, 4, 4, "F");
      doc.rect(w - 18, 14, 4, 4, "F");
      doc.rect(14, h - 18, 4, 4, "F");
      doc.rect(w - 18, h - 18, 4, 4, "F");

      // Title header letterhead
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("CAMPUS EVENT EXCELLENCE BOARD", w / 2, 34, { align: "center" });

      // Title
      doc.setTextColor(15, 23, 42);
      doc.setFont("Times", "italic");
      doc.setFontSize(30);
      doc.text("Certificate of Attendance", w / 2, 54, { align: "center" });

      // Description text
      doc.setTextColor(71, 85, 105);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text("THIS DOCUMENT PROUDLY VERIFIES AND CONSTITUTES THAT", w / 2, 72, { align: "center" });

      // Student Full Name in Bold Navy Blue
      doc.setTextColor(29, 78, 216);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(23);
      doc.text(studentName.toUpperCase(), w / 2, 87, { align: "center" });

      // Gold divider line underneath student
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.5);
      doc.line(w / 2 - 55, 91, w / 2 + 55, 91);

      // Description paragraph
      doc.setTextColor(71, 85, 105);
      doc.setFont("Times", "italic");
      doc.setFontSize(13);
      doc.text("has successfully participated and completed academic attendance requirements for", w / 2, 103, { align: "center" });

      // Seminar / Event name
      doc.setTextColor(15, 23, 42); 
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16.5);
      doc.text(`"${eventName}"`, w / 2, 114, { align: "center" });

      // Venue & Date
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`HELD UNDER SUPERVISION ON ${eventDate} AT "${venue}"`, w / 2, 124, { align: "center" });

      // Security Seal Drawing
      doc.setDrawColor(217, 119, 6);
      doc.setFillColor(254, 243, 199);
      doc.setLineWidth(1);
      doc.circle(w / 2, 146, 12, "FD");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      doc.text("OFFICIAL", w / 2, 144, { align: "center" });
      doc.setFontSize(5.5);
      doc.text("ATTENDANCE", w / 2, 148, { align: "center" });
      doc.text("RECORDED", w / 2, 151, { align: "center" });

      // Organizer signature string and line
      doc.setDrawColor(148, 163, 184); 
      doc.setLineWidth(0.5);
      doc.line(40, 172, 105, 172);

      doc.setTextColor(29, 78, 216);
      doc.setFont("Times", "italic");
      doc.setFontSize(13.5);
      doc.text(organizerName.replace("Prof. ", ""), 72.5, 167, { align: "center" });

      doc.setTextColor(71, 85, 105);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${organizerName}`, 72.5, 177, { align: "center" });
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("EVENT ORGANIZER SIGNATURE", 72.5, 181, { align: "center" });

      // Dean signature string and line
      doc.setDrawColor(148, 163, 184); 
      doc.line(w - 105, 172, w - 40, 172);

      doc.setTextColor(30, 41, 59);
      doc.setFont("Times", "italic");
      doc.setFontSize(13.5);
      doc.text("Dr. Arthur Pendelton", w - 72.5, 167, { align: "center" });

      doc.setTextColor(71, 85, 105);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Dr. Arthur Pendelton Dean", w - 72.5, 177, { align: "center" });
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("DEAN OF CAMPUS ACADEMICS", w - 72.5, 181, { align: "center" });

      // Footer tracking number
      doc.setTextColor(148, 163, 184);
      doc.setFont("Courier", "normal");
      doc.setFontSize(6.5);
      doc.text(`SYSTEM CHECK CODE VALUE: #EE-DB-A4-${studentName.length}${eventName.length}-${new Date(eventDate).getTime()}`, w / 2, 198, { align: "center" });

      // Trigger Save
      doc.save(`certificate-${eventName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
      setSuccessMsg("Your official attendance certificate has been rendered as landscape PDF.");
    } catch (e) {
      setError("Failed to compile vector PDF. Please check framework drivers.");
    }
  };

  // Split system catalog of broad events (anchor time: modern dynamic date)
  const todayStr = new Date().toISOString().split("T")[0];
  const registeredEvents = events.filter((e) => e.registered);
  const registeredUpcoming = events.filter((e) => e.event_date >= todayStr && e.registered);

  // Search filter matching name or department keywords in name, coordinator role/description and venue
  const filteredEvents = events.filter((e) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const matchName = (e.event_name || "").toLowerCase().includes(query);
    const matchDept = (e.organizer_role || "").toLowerCase().includes(query) || 
                      (e.description || "").toLowerCase().includes(query) ||
                      (e.venue || "").toLowerCase().includes(query) ||
                      (e.organizer_name || "").toLowerCase().includes(query);

    return matchName || matchDept;
  });

  const upcomingEvents = filteredEvents.filter((e) => e.event_date >= todayStr);
  const pastEvents = filteredEvents.filter((e) => e.event_date < todayStr);

  const getOverlappingEnrolledEvent = (availEv: any) => {
    for (const enrolled of registeredUpcoming) {
      if (enrolled.event_id === availEv.event_id) continue;
      if (enrolled.event_date === availEv.event_date) {
        const startE = enrolled.booking?.start_time || "09:30:00";
        const endE = enrolled.booking?.end_time || "12:30:00";
        const startA = availEv.booking?.start_time || "09:30:00";
        const endA = availEv.booking?.end_time || "12:30:00";
        
        if (startE < endA && endE > startA) {
          return enrolled;
        }
      }
    }
    return null;
  };

  const unreadNotifications = notifications.filter((n) => !n.read);

  return (
    <div id="student-dashboard" className="space-y-6">
      
      {/* Welcome Banner Card */}
      <div className="relative bg-white p-6 rounded-3xl border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 overflow-hidden shadow-xs">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-250 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Student Control panel
            </span>
            <span className="text-[10px] font-mono text-slate-400">Ledger ID: #{student.student_id}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Welcome back, <span className="text-blue-600">{student.name}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Field: <strong className="text-slate-800">{student.department}</strong> (Year {student.year}) | Email: <span className="text-slate-700 font-mono">{student.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          
          {/* Notifications Trigger */}
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              markAllNotificationsAsRead();
            }}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer relative ${
              showNotifications 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-white hover:bg-slate-50 border-slate-250 text-slate-700 hover:text-slate-900"
            }`}
          >
            <Bell className={`w-4 h-4 ${unreadNotifications.length > 0 ? "animate-bounce text-amber-500 fill-amber-300" : ""}`} />
            <span className="hidden sm:inline">System Alerts</span>
            {unreadNotifications.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-white shadow-sm">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          <button
            onClick={onLogout}
            className="text-xs font-semibold px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-250 rounded-xl cursor-pointer transition-all"
          >
            Disengage Session
          </button>
        </div>
      </div>

      {/* Trigger expandable alerts panel */}
      {showNotifications && (
        <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 space-y-3.5 animate-in slide-in-from-top-3 duration-250">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-amber-500" /> Notifications & Event Alerts
            </p>
            <button
              onClick={() => markAllNotificationsAsRead()}
              className="text-[10px] font-mono text-slate-400 hover:text-blue-400 underline"
            >
              Mark all read
            </button>
          </div>

          {notifications.length > 0 ? (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.notification_id} className={`p-3 rounded-xl border flex items-start gap-2.5 transition-colors ${n.read ? "bg-slate-850/40 border-slate-800/80" : "bg-slate-850 border-slate-700/60"}`}>
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5"></span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-xs font-bold text-slate-200">{n.title}</p>
                    <p className="text-xs text-slate-400 leading-snug">{n.message}</p>
                    <p className="text-[9px] text-slate-500 font-mono pt-1">
                      {new Date(n.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4 font-mono">No simulation alerts mapped on file yet.</p>
          )}
        </div>
      )}

      {/* Interface Responses */}
      {error && (
        <div className="bg-red-50 border border-red-250 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start gap-2 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-start gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* MAIN CONTAINER GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: EVENTS CATALOG & PAST LOGS */}
        <div className="xl:col-span-8 space-y-6">

          {/* Visual Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4 font-sans">
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                id="student-search-input"
                type="text"
                className="block w-full pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 border border-slate-255 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl transition-all"
                placeholder="Search events by name, department, or coordinator..."
                value={searchQuery}
                value-test-id="student-search-input"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  id="student-search-clear"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-550 select-none self-stretch justify-end md:self-auto">
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                Matched Seminars: <strong className="text-slate-800 font-bold">{filteredEvents.length}</strong> / {events.length}
              </span>
              {searchQuery && (
                <span className="px-2.5 py-1 bg-blue-50/80 text-blue-700 border border-blue-150 rounded-lg">
                  Term: <strong className="font-bold">"{searchQuery}"</strong>
                </span>
              )}
            </div>
          </div>

          {/* SECTION: MY CONFIRMED REGISTRATIONS (DIRECT REQUEST COMPLIANCE!) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 font-mono uppercase tracking-wider">
                <FileText className="w-4 h-4 text-blue-600" /> My Enrolled Events & Bookings
              </h3>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">
                Active Seats: {registeredUpcoming.length}
              </span>
            </div>

            {registeredUpcoming.length > 0 ? (
              <div className="space-y-3">
                {registeredUpcoming.map((rEv) => {
                  const isToday = rEv.event_date === new Date().toISOString().split("T")[0];
                  return (
                    <div
                      key={`enrolled-${rEv.event_id}`}
                      className={`border rounded-xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isToday ? "bg-amber-50/50 border-amber-305" : "bg-slate-50/20 border-slate-200"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            isToday ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse font-bold" : "bg-slate-100 text-slate-600 border-slate-250"
                          }`}>
                            {isToday ? "🚨 STARTS TODAY" : "SCHEDULED"}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">ID: #{rEv.event_id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Coordinator: <strong className="text-slate-800">{rEv.organizer_name}</strong>
                          </span>
                        </div>
                        
                        <h4 className="font-bold text-slate-900 text-sm truncate">{rEv.event_name}</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-[11px] text-slate-500 font-mono">
                          <p className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Date: {rEv.event_date}</span>
                          </p>
                          <p className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">Room: {rEv.venue}</span>
                          </p>
                          {rEv.registered_at && (
                            <p className="flex items-center gap-1 col-span-1 sm:col-span-2 md:col-span-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate text-slate-400 font-mono">Registered: {new Date(rEv.registered_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 pt-2 md:pt-0 self-end md:self-center flex flex-wrap items-center gap-2 font-sans">
                        {rEv.attendance_status === "Present" && (
                          <button
                            onClick={() => downloadCertificate(student.name, rEv.event_name, rEv.event_date, rEv.venue, rEv.organizer_name)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition-all text-[11px] cursor-pointer inline-flex items-center gap-1 hover:scale-[1.02] shadow-2xs"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Get Certificate</span>
                          </button>
                        )}
                        
                        {!rEv.feedback_submitted ? (
                          rEv.attendance_status === "Present" ? (
                            <button
                              onClick={() => {
                                setFeedbackEvent(rEv);
                                setError(null);
                                setSuccessMsg(null);
                              }}
                              className="text-[11px] font-mono font-bold text-blue-600 hover:text-blue-850 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-500" /> Give Feedback
                            </button>
                          ) : (
                            <span 
                              title="Certificate must be generated (marked Present) to leave feedback."
                              className="text-[11px] font-mono font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl select-none inline-flex items-center gap-1 cursor-not-allowed"
                            >
                              <Lock className="w-3 h-3 text-slate-400" /> Review Locked (Needs Cert)
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-mono font-semibold text-slate-550 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl select-none inline-flex items-center gap-1">
                            Review Left ({rEv.feedback_rating}★)
                          </span>
                        )}
                        <button
                          onClick={() => handleCancelRegistration(rEv.event_id)}
                          className="text-[11px] font-mono font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Stop Seat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <Calendar className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs">You have no active registration bookings.</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Select from the catalog catalogued below to request seats.</p>
              </div>
            )}
          </div>

          {/* CATALOG OF UPCOMING EVENTS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 font-mono uppercase tracking-wider">
                <Compass className="w-4 h-4 text-blue-600" /> Catalog of Upcoming College Seminars
              </h3>
              
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  id="toggle-grid-view"
                  onClick={() => setCatalogView("grid")}
                  className={`px-3 py-1.5 text-[10px] font-mono font-semibold tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                    catalogView === "grid"
                      ? "bg-white text-slate-950 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  List Grid
                </button>
                <button
                  type="button"
                  id="toggle-calendar-view"
                  onClick={() => setCatalogView("calendar")}
                  className={`px-3 py-1.5 text-[10px] font-mono font-semibold tracking-wider uppercase rounded-lg transition-all cursor-pointer ${
                    catalogView === "calendar"
                      ? "bg-white text-slate-950 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Interactive Calendar ({upcomingEvents.length})
                </button>
              </div>
            </div>

            {catalogView === "calendar" ? (
              <EventCalendar 
                events={filteredEvents}
                onRegister={handleRegister}
                onCancel={handleCancelRegistration}
                getOverlappingEnrolledEvent={getOverlappingEnrolledEvent}
              />
            ) : upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingEvents.map((ev) => {
                  const conflict = getOverlappingEnrolledEvent(ev);
                  return (
                    <div
                      key={ev.event_id}
                      className={`bg-slate-50/40 hover:bg-white border rounded-xl p-4 flex flex-col justify-between transition-all shadow-xs ${
                        conflict ? "border-amber-200" : "border-slate-200 hover:border-blue-400"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-250 px-2 py-0.5 rounded">
                            CODE: #EE-{ev.event_id}
                          </span>
                          {ev.registered ? (
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-250 px-2.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Booked
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100/80 px-1.5 py-0.5 border border-slate-200/50 rounded">
                              Cap: {ev.registrations_count || 0}/{ev.max_capacity}
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                          {ev.event_name}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {ev.description || "No description provided."}
                        </p>

                        <div className="text-[11px] text-slate-500 space-y-1 font-mono pt-1">
                          <p className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Date: {ev.event_date}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">Venue: {ev.venue}</span>
                          </p>
                        </div>

                        {conflict && (
                          <div className="text-[10px] text-amber-700 bg-amber-50/60 border border-amber-200 rounded-lg p-2 font-mono flex items-start gap-1 leading-snug">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span><strong>Schedule conflict:</strong> overlaps with your session <strong>"{conflict.event_name}"</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between">
                        {ev.registered ? (
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="text-xs text-emerald-750 font-semibold flex items-center gap-1 select-none">
                              ✓ Enrolled
                            </span>
                            <button
                              onClick={() => handleCancelRegistration(ev.event_id)}
                              className="text-[11px] font-mono font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Stop Seat
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRegister(ev.event_id)}
                            disabled={ev.registrations_count >= ev.max_capacity || !!conflict}
                            className={`w-full text-center text-xs py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                              ev.registrations_count >= ev.max_capacity
                                ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                                : conflict
                                  ? "bg-amber-100 border border-amber-200 text-amber-700 cursor-not-allowed uppercase tracking-wider text-[10px]"
                                  : "bg-blue-600 hover:bg-blue-700 text-white focus:ring-1 focus:ring-blue-300 shadow-xs"
                            }`}
                          >
                            {ev.registrations_count >= ev.max_capacity 
                              ? "Fully Booked" 
                              : conflict 
                                ? "Overlapping Slot" 
                                : "Reserve Seat"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs">No upcoming sessions mapped on database.</p>
              </div>
            )}
          </div>

          {/* HISTORICAL LOGS AND CERTIFICATE CORNER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 font-mono uppercase tracking-wider border-b border-slate-150 pb-2.5">
              <Clock className="w-4 h-4 text-blue-600" /> PAST CONFERENCES & CONVOKED CERTIFICATE GENERATION
            </h3>

            {pastEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Event Description</th>
                      <th className="px-4 py-3 font-semibold">Conducted Date</th>
                      <th className="px-4 py-3 font-semibold">Attendance</th>
                      <th className="px-4 py-3 font-semibold text-right">Certificate Download / Reviews</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {pastEvents.map((ev) => (
                      <tr key={ev.event_id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 leading-tight">{ev.event_name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">Coordinator: {ev.organizer_name}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{ev.event_date}</td>
                        <td className="px-4 py-3">
                          {!ev.registered ? (
                            <span className="text-slate-400 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">Not Enrolled</span>
                          ) : ev.attendance_status === "Present" ? (
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              ● Present
                            </span>
                          ) : ev.attendance_status === "Absent" ? (
                            <span className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full">
                              ● Absent
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                              Enrolled
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {ev.registered && ev.attendance_status === "Present" && (
                              <button
                                onClick={() => downloadCertificate(student.name, ev.event_name, ev.event_date, ev.venue, ev.organizer_name)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1 rounded-lg transition-all text-[11px] cursor-pointer inline-flex items-center gap-1 hover:scale-[1.02] shadow-2xs"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>Get Certificate</span>
                              </button>
                            )}

                            {ev.registered ? (
                              ev.feedback_submitted ? (
                                <span className="text-[10px] font-mono text-slate-400 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded select-none inline-flex items-center gap-0.5">
                                  Left: {ev.feedback_rating}★
                                </span>
                              ) : ev.attendance_status === "Present" ? (
                                <button
                                  onClick={() => {
                                    setFeedbackEvent(ev);
                                    setError(null);
                                    setSuccessMsg(null);
                                  }}
                                  className="bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-250 text-blue-700 font-semibold px-2.5 py-1 rounded-lg transition-all text-[11px] cursor-pointer"
                                >
                                  Leave Review
                                </button>
                              ) : (
                                <span 
                                  title="Certificate must be generated (marked Present) to leave feedback."
                                  className="text-[10px] font-mono text-slate-400 border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 rounded-lg select-none inline-flex items-center gap-1 cursor-not-allowed"
                                >
                                  <Lock className="w-3 h-3 text-slate-400" /> Locked (No Cert)
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No completed historic events found on file.</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FLOATING FEEDBACK BUILDER */}
        <div className="xl:col-span-4">
          {feedbackEvent ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs sticky top-6 space-y-4 animate-in fade-in slide-in-from-right-3 duration-200 z-10">
              <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
                <h4 className="font-bold text-slate-800 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400 animate-spin-once" /> WRITE EVENT FEEDBACK
                </h4>
                <button
                  onClick={() => setFeedbackEvent(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Selected Event</span>
                <p className="font-bold text-sm text-slate-900 leading-snug">{feedbackEvent.event_name}</p>
                <p className="text-[11px] text-slate-500 font-mono">Convent Date: {feedbackEvent.event_date}</p>
              </div>

              <form onSubmit={submitFeedback} className="space-y-4">
                {/* Rating selection (1-5 star) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Rating Score</span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="group focus:outline-none cursor-pointer"
                      >
                        <Star
                          className={`w-6 h-6 transition-transform hover:scale-110 ${
                            star <= rating ? "text-amber-500 fill-amber-400" : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-mono font-bold text-slate-500 ml-2">({rating} / 5)</span>
                  </div>
                </div>

                {/* Comment area */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Review Comments</span>
                  <textarea
                    required
                    placeholder="Provide constructive comments about your experience..."
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all font-sans"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isLoading ? "Writing Review..." : "Commit Feedback Report"}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-100/60 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400 space-y-2 sticky top-6">
              <Star className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider font-mono">Feedback Center</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                Once an event has completed, click \"Leave Review\" in your history logs table to submit your comments on the event program.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
