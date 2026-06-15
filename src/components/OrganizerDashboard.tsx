import React, { useState, useEffect } from "react";
import { 
  Calendar, CheckCircle, XCircle, Search, Clock, PlusCircle, 
  MapPin, AlertCircle, RefreshCw, BarChart2, Star, Check 
} from "lucide-react";
import { Classroom, Event } from "../types";

interface OrganizerDashboardProps {
  organizer: {
    organizer_id: number;
    organizer_name: string;
    organizer_role: string;
    phone: string;
  };
  onLogout: () => void;
}

export default function OrganizerDashboard({ organizer, onLogout }: OrganizerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"catalog" | "classrooms" | "feedback">("catalog");
  const [events, setEvents] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  // Selected event for attendance management
  const [selectedEventId, setSelectedEventId] = useState<number | "">("");
  const [attendanceList, setAttendanceList] = useState<any[]>([]);

  // Create event states
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [evName, setEvName] = useState("");
  const [evDate, setEvDate] = useState("2026-06-30");
  const [evVenue, setEvVenue] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evCap, setEvCap] = useState("120");
  const [creationClassroomSuggestions, setCreationClassroomSuggestions] = useState<any[]>([]);
  const [selectedCreationClassroomId, setSelectedCreationClassroomId] = useState<number | null>(null);

  // Booking states
  const [bookEventId, setBookEventId] = useState<number | "">("");
  const [bookClassId, setBookClassId] = useState<number | "">("");
  const [bookDate, setBookDate] = useState("2026-06-15");
  const [bookStart, setBookStart] = useState("09:00:00");
  const [bookEnd, setBookEnd] = useState("12:00:00");

  // Query states (vacant classroom finder)
  const [searchDate, setSearchDate] = useState("2026-06-15");
  const [searchStart, setSearchStart] = useState("10:00:00");
  const [searchEnd, setSearchEnd] = useState("12:00:00");
  const [vacantClassrooms, setVacantClassrooms] = useState<Classroom[]>([]);

  // Notification boxes
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Edit event states (Direct compliance for editing/deleting existing events)
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEvName, setEditEvName] = useState("");
  const [editEvDate, setEditEvDate] = useState("");
  const [editEvVenue, setEditEvVenue] = useState("");
  const [editEvCap, setEditEvCap] = useState("");
  const [editEvDesc, setEditEvDesc] = useState("");

  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "high">("all");

  const fetchFeedbacks = async () => {
    try {
      const id = feedbackFilter === "high" ? "high_feedbacks" : "all_feedbacks";
      const res = await fetch(`/api/queries/run?id=${id}`);
      const data = await res.json();
      setFeedbacks(data.rows || []);
    } catch (err) {
      // Quietly swallow feedback fetching issues
    }
  };

  const loadData = async () => {
    try {
      const evRes = await fetch("/api/events");
      setEvents(await evRes.json());

      const classRes = await fetch("/api/classrooms");
      setClassrooms(await classRes.json());

      fetchFeedbacks();
    } catch (err) {
      // Quietly handle organizer data load issues
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [feedbackFilter]);

  useEffect(() => {
    loadData();
  }, []);

  const fetchCreationSuggestions = async () => {
    if (!evDate) return;
    try {
      const res = await fetch(`/api/queries/run?id=available_classrooms&date=${evDate}`);
      const data = await res.json();
      setCreationClassroomSuggestions(data.rows || []);
    } catch (err) {
      // Quietly swallow creation room suggestion errors
    }
  };

  useEffect(() => {
    fetchCreationSuggestions();
  }, [evDate]);

  // Fetch attendees list when active event changes
  const fetchAttendeesList = async (eventId: number) => {
    try {
      const res = await fetch(`/api/queries/run?id=event_attendance&event_id=${eventId}`);
      const data = await res.json();
      setAttendanceList(data.rows || []);
    } catch (err) {
      // Quietly handle attendee list fetching errors
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchAttendeesList(Number(selectedEventId));
      const matched = events.find((e) => e.event_id === Number(selectedEventId));
      if (matched) {
        setEditEvName(matched.event_name || "");
        setEditEvDate(matched.event_date || "");
        setEditEvVenue(matched.venue || "");
        setEditEvCap(String(matched.max_capacity || 100));
        setEditEvDesc(matched.description || "");
      }
      setIsEditingEvent(false);
    } else {
      setAttendanceList([]);
      setIsEditingEvent(false);
    }
  }, [selectedEventId, events]);

  // Handle student attendance login toggling
  const handleUpdateAttendance = async (studentId: number, status: "Present" | "Absent" | "Registered") => {
    if (!selectedEventId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Let's directly read registries or query from database
      const response = await fetch(`/api/queries/run?id=event_attendance&event_id=${selectedEventId}`);
      const attendees = await response.json();
      
      // Locate registration on the rows list
      const targetQuery = (attendees.rows || []).find((r: any) => r.student_id === studentId);
      
      if (!targetQuery || !targetQuery.registration_id) {
        throw new Error("Could not find registration_id for this attendee.");
      }

      const updateRes = await fetch("/api/organizer/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: targetQuery.registration_id,
          attendance_status: status
        })
      });

      if (!updateRes.ok) {
        const errObj = await updateRes.json();
        throw new Error(errObj.error || "Failed to save attendance.");
      }

      setSuccessMsg("Attendance status updated successfully.");
      fetchAttendeesList(Number(selectedEventId));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record attendance status.");
    }
  };

  // Find vacant classrooms on slot (Corresponds to query 4)
  const findVacantClassrooms = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const params = new URLSearchParams({
        id: "available_classrooms",
        date: searchDate,
        start_time: searchStart,
        end_time: searchEnd
      });
      const response = await fetch(`/api/queries/run?${params.toString()}`);
      const data = await response.json();
      setVacantClassrooms(data.rows || []);
      setSuccessMsg(`Fetched classroom vacancies for slot successfully.`);
    } catch (err) {
      setErrorMsg("Failed to query classroom availability.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    findVacantClassrooms();
  }, [searchDate, searchStart, searchEnd]);

  // Book a classroom for an event (Trigger test)
  const handleBookClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookEventId || !bookClassId) {
      setErrorMsg("Please select an Event and Classroom to book.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: Number(bookEventId),
          classroom_id: Number(bookClassId),
          booking_date: bookDate,
          start_time: bookStart,
          end_time: bookEnd
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Conflict rule violation");
      }

      setSuccessMsg("Success! Classroom booked. Relational trigger and capacity constraints validated successfully.");
      loadData();
      findVacantClassrooms();
      setBookClassId("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to finalize classroom booking.");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit new Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!evName || !evDate || !evVenue || !evCap) {
      setErrorMsg("Please fill out all mandatory event fields");
      return;
    }

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: evName,
          event_date: evDate,
          venue: evVenue,
          description: evDesc,
          max_capacity: evCap,
          // associate organizer automatically
          organizer_name: organizer.organizer_name,
          organizer_role: organizer.organizer_role,
          organizer_phone: organizer.phone,
          classroom_id: selectedCreationClassroomId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create event");
      }

      setSuccessMsg(`Created event "${evName}" inside the database.`);
      setShowCreateEvent(false);
      setEvName("");
      setEvDesc("");
      setSelectedCreationClassroomId(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Update existing event details (Direct compliance)
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/events/${selectedEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: editEvName,
          event_date: editEvDate,
          venue: editEvVenue,
          max_capacity: editEvCap,
          description: editEvDesc
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update event details");
      }

      setSuccessMsg(`Successfully saved updates for "${editEvName}".`);
      setIsEditingEvent(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Delete event and cascade clear (Direct compliance)
  const handleDeleteEvent = async () => {
    if (!selectedEventId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`/api/events/${selectedEventId}`, {
        method: "DELETE"
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete event");
      }

      setSuccessMsg("Event cancelled successfully and database integrity preserved.");
      setSelectedEventId("");
      setIsEditingEvent(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin & Organizer Console
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-medium">Session ID: {organizer.organizer_id}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Workspace: <span className="text-blue-600 font-black">{organizer.organizer_name}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Role: <strong className="text-slate-700 font-semibold">{organizer.organizer_role}</strong> | Contact: <code className="text-slate-650 bg-slate-50 border border-slate-200/60 px-1 py-0.5 rounded font-mono font-semibold">{organizer.phone}</code>
          </p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold px-4 py-2 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-xl cursor-pointer transition-all shadow-xs"
        >
          Disengage Session
        </button>
      </div>

      {/* Organizer Navigation */}
      <div className="flex border-b border-slate-200 text-sm gap-2">
        <button
          onClick={() => {
            setActiveTab("catalog");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`px-4 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "catalog"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Event & Attendance Manager
        </button>
        <button
          onClick={() => {
            setActiveTab("classrooms");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`px-4 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "classrooms"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Classroom Booking Controller
        </button>
        <button
          onClick={() => {
            setActiveTab("feedback");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`px-4 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "feedback"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Feedback Hub Analyzer
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="font-semibold">{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-start gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* TAB 1: Event & Attendance Manager */}
      {activeTab === "catalog" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main events panel */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">
                  Managed Campus Programs
                </h3>
                <button
                  onClick={() => setShowCreateEvent(!showCreateEvent)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Define Event Record
                </button>
              </div>

              {/* New Event Form */}
              {showCreateEvent && (
                <form onSubmit={handleCreateEvent} className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/65 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 font-mono uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5 text-blue-600" /> Insert Into EVENT & ORGANIZER
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-slate-505 font-bold">Event Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Tech Symposium"
                      value={evName}
                      onChange={(e) => setEvName(e.target.value)}
                      className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-850"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-505 font-bold font-semibold">Date</label>
                      <input
                        type="date"
                        required
                        value={evDate}
                        onChange={(e) => setEvDate(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-850"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-505 font-bold font-semibold">Venue Location</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Main Auditorium"
                        value={evVenue}
                        onChange={(e) => setEvVenue(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-850"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 bg-blue-50/40 rounded-xl border border-blue-200/50">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-blue-800 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" /> Suggested Vacant Classrooms on {evDate || "selected date"}:
                    </p>
                    {creationClassroomSuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {creationClassroomSuggestions.map((room) => {
                          const isSelected = selectedCreationClassroomId === room.classroom_id;
                          return (
                            <button
                              key={`creation-suggest-${room.classroom_id}`}
                              type="button"
                              onClick={() => {
                                setEvVenue(`${room.block_name} - ${room.room_number}`);
                                setSelectedCreationClassroomId(room.classroom_id);
                              }}
                              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-700 font-bold shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                              }`}
                            >
                              <span>{room.block_name} - {room.room_number} (Cap: {room.capacity})</span>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-mono italic">No pre-existing available classrooms found on this date. A new Seminar Suite will be automatically provisioned for you upon event creation!</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-505 font-bold font-semibold">Max Capacity</label>
                      <input
                        type="number"
                        required
                        value={evCap}
                        onChange={(e) => setEvCap(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-850"
                      />
                    </div>
                    <div className="space-y-1 col-span-1 flex items-end">
                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-colors shadow-xs"
                      >
                        Write to DB
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-slate-505 font-bold font-semibold">Description</label>
                    <textarea
                      placeholder="Include research topics or highlights..."
                      rows={2}
                      value={evDesc}
                      onChange={(e) => setEvDesc(e.target.value)}
                      className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-850"
                    ></textarea>
                  </div>
                </form>
              )}

              {/* Event Cards */}
              <div className="space-y-3">
                {events.map((e) => (
                  <div
                    key={e.event_id}
                    onClick={() => setSelectedEventId(e.event_id)}
                    className={`p-4 border rounded-xl flex items-start justify-between cursor-pointer transition-all ${
                      selectedEventId === e.event_id
                        ? "bg-blue-50/50 border-blue-400 text-slate-900 shadow-xs font-semibold"
                        : "bg-white border-slate-200/80 hover:border-slate-350 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <div className="space-y-1 max-w-[70%]">
                      <span className="text-[9px] font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                        ID: {e.event_id}
                      </span>
                      <h4 className={`font-bold text-sm truncate mt-1.5 ${selectedEventId === e.event_id ? 'text-slate-950 font-black' : 'text-slate-800'}`}>
                        {e.event_name}
                      </h4>
                      <p className="text-[11px] text-slate-450 font-mono flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> {e.event_date} | <MapPin className="w-3.5 h-3.5 text-slate-400" /> {e.venue}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed truncate mt-0.5">{e.description}</p>
                    </div>

                    <div className="text-right space-y-1 shrink-0">
                      <span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-150 px-2.5 py-0.5 rounded-full block">
                        {e.registrations_count} Registrants
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        Limit: {e.max_capacity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Attendance Logger */}
          <div className="xl:col-span-5">
            {selectedEventId ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">
                      Event Control Panel
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                      Target Event ID: <strong className="text-blue-600 font-semibold">#{selectedEventId}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingEvent(!isEditingEvent)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-105 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      {isEditingEvent ? "Review Attendance" : "Edit Seminar"}
                    </button>
                    <button
                      onClick={handleDeleteEvent}
                      className="text-[11px] font-bold text-red-650 hover:text-red-850 bg-red-50 hover:bg-red-105 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      Purge Event
                    </button>
                  </div>
                </div>

                {isEditingEvent ? (
                  <form onSubmit={handleUpdateEvent} className="space-y-4 text-xs animate-in fade-in duration-200">
                    <h4 className="font-bold text-slate-800 font-mono uppercase tracking-wider text-[10px] border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                      ✏️ Edit Event Details
                    </h4>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Event Name</label>
                      <input
                        type="text"
                        required
                        value={editEvName}
                        onChange={(e) => setEditEvName(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Date</label>
                        <input
                          type="date"
                          required
                          value={editEvDate}
                          onChange={(e) => setEditEvDate(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Venue Location</label>
                        <input
                          type="text"
                          required
                          value={editEvVenue}
                          onChange={(e) => setEditEvVenue(e.target.value)}
                          className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Maximum Capacity</label>
                      <input
                        type="number"
                        required
                        value={editEvCap}
                        onChange={(e) => setEditEvCap(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Description Highlights</label>
                      <textarea
                        rows={3}
                        value={editEvDesc}
                        onChange={(e) => setEditEvDesc(e.target.value)}
                        className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800 font-sans"
                      ></textarea>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-xs"
                      >
                        Commit Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEvent(false)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : attendanceList.length > 0 ? (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {attendanceList.map((attendee) => (
                      <div
                        key={attendee.student_id}
                        className="bg-slate-50/50 border border-slate-150 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{attendee.student_name}</p>
                          <p className="text-[10px] text-slate-450 font-mono mt-0.5">
                            ID: {attendee.student_id} | {attendee.department}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {(["Present", "Absent", "Registered"] as const).map((status) => (
                            <button
                              key={status}
                              onClick={async () => {
                                // Find registration id on backend
                                const dbRes = await fetch("/api/events");
                                // We simulate clicking of attendance toggle - let's fetch backend registrations
                                const getRegs = await fetch(`/api/queries/run?id=event_attendance&event_id=${selectedEventId}`);
                                const attenData = await getRegs.json();
                                if (attendee.registration_id) {
                                  const response = await fetch("/api/organizer/attendance", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      registration_id: attendee.registration_id,
                                      attendance_status: status
                                    })
                                  });
                                  if (response.ok) {
                                    setSuccessMsg(`Logged student ${attendee.student_name} as ${status}.`);
                                    fetchAttendeesList(Number(selectedEventId));
                                    loadData();
                                  } else {
                                    setErrorMsg("Failed to update status record.");
                                  }
                                } else {
                                  setErrorMsg("Pending server registration resolution.");
                                }
                              }}
                              className={`text-[9px] font-mono font-semibold px-2 py-1 rounded-md border transition-all cursor-pointer ${
                                attendee.attendance_status === status
                                  ? status === "Present"
                                    ? "bg-green-50 border-green-200 text-green-700 font-bold"
                                    : status === "Absent"
                                    ? "bg-red-50 border-red-200 text-red-700 font-bold"
                                    : "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                                  : "bg-white border-slate-200 text-slate-400 hover:border-slate-350 hover:text-slate-800"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6 border border-slate-200 border-dashed rounded-xl">
                    No student registrations logged for this event.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400 space-y-2">
                <CheckCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="font-bold text-xs text-slate-600 uppercase tracking-widest font-mono">Attendance Center Idle</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Click on any event card from the left panel to display and log student attendance records.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Classroom Booking Controller */}
      {activeTab === "classrooms" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Booking scheduler */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono border-b border-slate-100 pb-3">
                Allocate Classroom Hall
              </h3>

              <form onSubmit={handleBookClassroom} className="space-y-4 text-xs">
                {/* Event picker */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Target Event</label>
                  <select
                    value={bookEventId}
                    onChange={(e) => setBookEventId(e.target.value)}
                    className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-slate-800 font-medium"
                    required
                  >
                    <option value="">-- Choose Event --</option>
                    {events.map((e) => (
                      <option key={e.event_id} value={e.event_id}>
                        {e.event_name} (Seatings: {e.max_capacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Classroom picker */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Classroom</label>
                  <select
                    value={bookClassId}
                    onChange={(e) => setBookClassId(e.target.value)}
                    className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-slate-800 font-medium"
                    required
                  >
                    <option value="">-- Choose Classroom --</option>
                    {classrooms.map((c) => (
                      <option key={c.classroom_id} value={c.classroom_id}>
                        {c.block_name} - {c.room_number} (Capacity: {c.capacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scheduling Parameters */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-slate-505 font-bold">Date</label>
                    <input
                      type="date"
                      value={bookDate}
                      onChange={(e) => setBookDate(e.target.value)}
                      className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none text-xs rounded-xl px-2 py-2 text-slate-800"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-slate-505 font-bold">Start Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 09:30:00"
                      value={bookStart}
                      onChange={(e) => setBookStart(e.target.value)}
                      className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none text-xs font-mono rounded-xl px-2 py-2 text-slate-800"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-slate-505 font-bold">End Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 15:30:00"
                      value={bookEnd}
                      onChange={(e) => setBookEnd(e.target.value)}
                      className="w-full bg-white border border-slate-250 focus:border-blue-600 focus:outline-none text-xs font-mono rounded-xl px-2 py-2 text-slate-800"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Verify Overlaps & Save Booking
                </button>
              </form>
            </div>
          </div>

          {/* Right: Vacant list */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3 gap-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600" /> Vacant Room Finder
                </h3>

                {/* Slot inputs filters */}
                <div className="flex gap-2 text-[10px] font-mono">
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="bg-white border border-slate-250 text-[10px] rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={searchStart}
                    onChange={(e) => setSearchStart(e.target.value)}
                    className="bg-white border border-slate-250 text-[10px] rounded-lg px-2.5 py-1 text-slate-800 w-16 text-center focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-slate-400 my-auto">-</span>
                  <input
                    type="text"
                    value={searchEnd}
                    onChange={(e) => setSearchEnd(e.target.value)}
                    className="bg-white border border-slate-255 text-[10px] rounded-lg px-2.5 py-1 text-slate-800 w-16 text-center focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Vacant List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vacantClassrooms.map((c) => (
                  <div
                    key={c.classroom_id}
                    className="bg-slate-50/50 p-4 rounded-2xl border border-slate-150 flex items-start gap-3.5 shadow-2xs"
                  >
                    <div className="p-2 bg-blue-50 text-blue-600 border border-blue-105 rounded-xl">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                        {c.block_name}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5">Room {c.room_number}</p>
                      <p className="text-[10px] font-mono text-slate-450 mt-1.5 font-medium">
                        Capacity: <span className="text-blue-600 font-bold">{c.capacity} seats</span>
                      </p>
                    </div>
                  </div>
                ))}
                {vacantClassrooms.length === 0 && (
                  <div className="col-span-2 text-center text-slate-450 py-8 font-mono text-xs">
                    No vacant rooms detected. Try shifting schedule dates or periods!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Feedback Hub Analyzer */}
      {activeTab === "feedback" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">
                Student Review Sentiment Board
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Analyze student evaluation reviews, scale ratios, and qualitative feedback logs.
              </p>
            </div>
            <div className="flex bg-slate-105 p-1 rounded-xl border border-slate-200 self-start sm:self-auto font-mono text-[9px] font-bold">
              <button
                type="button"
                onClick={() => setFeedbackFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                  feedbackFilter === "all"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Feedbacks {feedbackFilter === "all" && "✓"}
              </button>
              <button
                type="button"
                onClick={() => setFeedbackFilter("high")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                  feedbackFilter === "high"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200 font-extrabold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Highly Rated (★ &gt;= 4) {feedbackFilter === "high" && "✓"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedbacks.map((item) => (
              <div
                key={item.feedback_id}
                className="bg-slate-50/30 p-4 border border-slate-200 rounded-2xl space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-150 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                    STUDENT {item.student_id}: {item.student_name}
                  </span>
                  <span className="text-amber-700 text-xs font-bold flex items-center gap-0.5 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shadow-2xs">
                    <Star className="w-3 h-3 fill-current text-amber-500" /> {item.rating} / 5
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 text-xs">
                  Event Program: {item.event_name}
                </h4>
                <p className="text-xs text-slate-500 italic leading-relaxed pt-2 border-t border-slate-150 border-dashed">
                  "{item.comments}"
                </p>
              </div>
            ))}

            {feedbacks.length === 0 && (
              <p className="text-xs text-slate-400 font-mono col-span-2 text-center py-8">
                No high ratings feedback on file inside database storage buffer.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
