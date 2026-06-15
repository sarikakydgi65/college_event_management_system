import React, { useState, useEffect } from "react";
import { Database, FileText, Play, Download, Terminal, Settings, Copy, Check, ChevronRight } from "lucide-react";

interface QueryResult {
  queryId: string;
  rows_count: number;
  rows: any[];
}

export default function DBTerminal() {
  const [selectedQueryId, setSelectedQueryId] = useState<string>("upcoming_events");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"terminal" | "schema" | "guide">("terminal");
  const [schemaText, setSchemaText] = useState<string>("");

  // Input states for dynamic query exploration
  const [queryDate, setQueryDate] = useState<string>("2026-06-15");
  const [queryStartTime, setQueryStartTime] = useState<string>("10:00:00");
  const [queryEndTime, setQueryEndTime] = useState<string>("12:00:00");
  const [queryEventId, setQueryEventId] = useState<string>("101");
  const [queryStudentId, setQueryStudentId] = useState<string>("1");

  const queriesList = [
    {
      id: "upcoming_events",
      title: "1. Show Upcoming Events",
      category: "Required Workload",
      description: "Lists all future events on or after the anchor date (2026-05-28), ordered chronologically. Crucial for campus display systems.",
      sql: `-- List all upcoming events with their date and venue\nSELECT event_id, event_name, event_date, venue\nFROM EVENT\nWHERE event_date >= '2026-05-28'\nORDER BY event_date ASC;`
    },
    {
      id: "registration_counts",
      title: "2. Total Registrations per Event",
      category: "Required Workload",
      description: "Performs a LEFT JOIN between EVENT and REGISTRATION, counting enrolled rows grouped by event_id. Identifies booking metrics.",
      sql: `-- Count total registrations for each event\nSELECT e.event_id, e.event_name, COUNT(r.registration_id) AS total_registrations\nFROM EVENT e\nLEFT JOIN REGISTRATION r ON e.event_id = r.event_id\nGROUP BY e.event_id, e.event_name\nORDER BY total_registrations DESC;`
    },
    {
      id: "event_attendance",
      title: "3. Class Attendance List for Event",
      category: "Required Workload",
      description: "Inner joins STUDENT and REGISTRATION for a target event_id. Used by lecturers or student union officials to log attendance.",
      sql: `-- List students and their attendance status for a particular event\nSELECT s.student_id, s.name, s.department, r.attendance_status\nFROM REGISTRATION r\nJOIN STUDENT s ON r.student_id = s.student_id\nWHERE r.event_id = 101;`
    },
    {
      id: "available_classrooms",
      title: "4. Vaccine Room/Classroom Finder",
      category: "Required Workload",
      description: "Uses a nested NOT IN subquery against CLASSROOM_BOOKING to discover classrooms that are vacant during a specified date and time interval, safely avoiding double booking overlays.",
      sql: `-- Show all available classrooms (not booked) on a given date and time slot\nSELECT classroom_id, block_name, room_number, capacity\nFROM CLASSROOM\nWHERE classroom_id NOT IN (\n    SELECT classroom_id\n    FROM CLASSROOM_BOOKING\n    WHERE booking_date = '2026-06-15'\n      AND booking_status = 'Confirmed'\n      AND start_time < '12:00:00'\n      AND end_time > '10:00:00'\n);`
    },
    {
      id: "high_feedbacks",
      title: "5. Highly Rated Event Feedbacks (>= 4)",
      category: "Required Workload",
      description: "Filters reviews with rating scores set at 4 or 5 star quality, joining STUDENT and EVENT to present clear readability.",
      sql: `-- Display feedback with rating greater than or equal to 4\nSELECT f.feedback_id, s.name AS student_name, e.event_name, f.rating, f.comments\nFROM FEEDBACK f\nJOIN STUDENT s ON f.student_id = s.student_id\nJOIN EVENT e ON f.event_id = e.event_id\nWHERE f.rating >= 4\nORDER BY f.rating DESC;`
    },
    {
      id: "attendance_percentages",
      title: "6. Attendance Conversion Rate",
      category: "Additional Insight",
      description: "Divides students logged as 'Present' by total registrars per event, highlighting performance rates in finished programs.",
      sql: `-- Show attendance percentage per event\nSELECT e.event_id, e.event_name,\n  COUNT(r.registration_id) AS total_registrations,\n  SUM(CASE WHEN r.attendance_status = 'Present' THEN 1 ELSE 0 END) AS present_count,\n  ROUND((SUM(CASE WHEN r.attendance_status = 'Present' THEN 1 ELSE 0 END) / COUNT(r.registration_id)) * 100, 2) AS attendance_percentage\nFROM EVENT e\nJOIN REGISTRATION r ON e.event_id = r.event_id\nGROUP BY e.event_id, e.event_name\nHAVING COUNT(r.registration_id) > 0;`
    },
    {
      id: "student_registration_history",
      title: "7. Individual Student's Agenda",
      category: "Additional Insight",
      description: "Acquires specific registrations and attendance histories representing a chosen student_id's personal academic log.",
      sql: `-- List all events a specific student registered for, with attendance status\nSELECT e.event_id, e.event_name, e.event_date, r.attendance_status\nFROM REGISTRATION r\nJOIN EVENT e ON r.event_id = e.event_id\nWHERE r.student_id = 1;`
    },
    {
      id: "most_popular_event",
      title: "8. Campus Highlight (Most Registered)",
      category: "Additional Insight",
      description: "Aggregates registration quantities and limits returning query with LIMIT 1 to point out the most joined campus event.",
      sql: `-- Find the most popular event based on maximum registration count\nSELECT e.event_id, e.event_name, COUNT(r.registration_id) AS reg_count, e.venue\nFROM EVENT e\nLEFT JOIN REGISTRATION r ON e.event_id = r.event_id\nGROUP BY e.event_id, e.event_name, e.venue\nORDER BY reg_count DESC\nLIMIT 1;`
    }
  ];

  const activeQuery = queriesList.find((q) => q.id === selectedQueryId) || queriesList[0];

  const runQueryOnBackend = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        id: selectedQueryId,
        date: queryDate,
        start_time: queryStartTime,
        end_time: queryEndTime,
        event_id: queryEventId,
        student_id: queryStudentId
      });
      const response = await fetch(`/api/queries/run?${params.toString()}`);
      if (!response.ok) throw new Error("Database failed to process queries code.");
      const data = await response.json();
      setQueryResult(data);
    } catch (err) {
      // Quietly handle query execution issues
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runQueryOnBackend();
  }, [selectedQueryId, queryDate, queryStartTime, queryEndTime, queryEventId, queryStudentId]);

  // Fetch the schema.sql file content when clicking on schema tab
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch("/api/schema-download");
        if (response.ok) {
          const text = await response.text();
          setSchemaText(text);
        }
      } catch (err) {
        // Quietly swallow schema loading issues
      }
    };
    fetchSchema();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-0">
      {/* DB Console Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200/50 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-950 flex items-center gap-2">
              Relational DB Terminal
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                MySQL 8.0 Active
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Inspect database code, execute queries, and explore backend structural mappings.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono w-full sm:w-auto">
          <button
            onClick={() => setCurrentTab("terminal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              currentTab === "terminal" ? "bg-white text-slate-900 shadow-xs border border-slate-200/50 font-semibold" : "hover:text-slate-900"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            SQL CLI
          </button>
          <button
            onClick={() => setCurrentTab("schema")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              currentTab === "schema" ? "bg-white text-slate-900 shadow-xs border border-slate-200/50 font-semibold" : "hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            schema.sql
          </button>
          <button
            onClick={() => setCurrentTab("guide")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              currentTab === "guide" ? "bg-white text-slate-900 shadow-xs border border-slate-200/50 font-semibold" : "hover:text-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Connection Guide
          </button>
        </div>
      </div>

      {currentTab === "terminal" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          {/* Left Column: Query Selection */}
          <div className="lg:col-span-4 border-r border-slate-200 p-4 space-y-3 bg-slate-50/50">
            <h4 className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider mb-2">
              Select SQL Workloads
            </h4>
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {queriesList.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQueryId(q.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                    selectedQueryId === q.id
                      ? "bg-blue-50/80 border-blue-300 text-slate-900 shadow-xs font-semibold"
                      : "bg-white border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{q.title}</span>
                    <span
                      className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${
                        q.category === "Required Workload"
                          ? "bg-slate-100 border border-slate-250 text-slate-700"
                          : "bg-blue-50 text-blue-700 border border-blue-150"
                      }`}
                    >
                      {q.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{q.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: SQL Output + Execution Results */}
          <div className="lg:col-span-8 flex flex-col bg-slate-50/20">
            {/* Explainer Panel */}
            <div className="p-4 bg-white border-b border-slate-200">
              <h4 className="text-xs font-semibold text-slate-700 font-mono">Query Operational Logic:</h4>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                {activeQuery.description}
              </p>

              {/* Dynamic Parameter Injectors */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedQueryId === "available_classrooms" && (
                  <>
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-450 font-semibold">BOOKING DATE</span>
                      <input
                        type="date"
                        value={queryDate}
                        onChange={(e) => setQueryDate(e.target.value)}
                        className="w-full bg-white border border-slate-250 text-[11px] rounded px-2.5 py-1 text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-455 font-semibold">START TIME</span>
                      <input
                        type="text"
                        value={queryStartTime}
                        onChange={(e) => setQueryStartTime(e.target.value)}
                        className="w-full bg-white border border-slate-250 text-[11px] font-mono rounded px-2.5 py-1 text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-slate-455 font-semibold">END TIME</span>
                      <input
                        type="text"
                        value={queryEndTime}
                        onChange={(e) => setQueryEndTime(e.target.value)}
                        className="w-full bg-white border border-slate-250 text-[11px] font-mono rounded px-2.5 py-1 text-slate-800"
                      />
                    </div>
                  </>
                )}

                {selectedQueryId === "event_attendance" && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-[10px] font-mono text-slate-455 font-semibold">TARGET EVENT ID</span>
                    <select
                      value={queryEventId}
                      onChange={(e) => setQueryEventId(e.target.value)}
                      className="w-full bg-white border border-slate-250 text-[11px] rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="101">101 - National Tech Symposium</option>
                      <option value="102">102 - Art & Culture Fest 2026</option>
                      <option value="103">103 - AI & Robotics Workshop</option>
                      <option value="104">104 - Orientation Ceremony 2026</option>
                    </select>
                  </div>
                )}

                {selectedQueryId === "student_registration_history" && (
                  <div className="space-y-1 col-span-2">
                    <span className="text-[10px] font-mono text-slate-455 font-semibold">STUDENT ID FILTER</span>
                    <select
                      value={queryStudentId}
                      onChange={(e) => setQueryStudentId(e.target.value)}
                      className="w-full bg-white border border-slate-250 text-[11px] rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="1">Student 1 - Alice Vance</option>
                      <option value="2">Student 2 - Bob Sterling</option>
                      <option value="3">Student 3 - Charlie Dev</option>
                      <option value="4">Student 4 - Diana Prince</option>
                      <option value="5">Student 5 - Ethan Hunt</option>
                      <option value="6">Student 6 - Fiona Glenanne</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* SQL Terminal Display Box */}
            <div className="relative font-mono text-xs bg-slate-900 p-4 border-b border-slate-200 flex-1 flex flex-col justify-between">
              <button
                onClick={() => handleCopy(activeQuery.sql, "sql")}
                className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800/80 p-2 rounded border border-slate-700/60 cursor-pointer"
                title="Copy SQL Query"
              >
                {copiedText === "sql" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed pr-12">
                {activeQuery.sql}
              </pre>
              <div className="border-t border-slate-800/60 border-dashed pt-3 mt-4 flex items-center justify-between text-[11px] text-slate-400">
                <span>● Database connection payload ready for execution.</span>
                <button
                  onClick={runQueryOnBackend}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold hover:shadow px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  {isLoading ? "Running..." : "Run Query"}
                </button>
              </div>
            </div>

            {/* Live Data Simulation Rows Result */}
            <div className="p-4 flex-1">
              <h4 className="text-xs font-semibold text-slate-700 font-mono mb-2.5 flex items-center gap-2">
                Query Console Output Set:
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 border border-slate-200 rounded">
                  {queryResult?.rows_count || 0} rows count returned
                </span>
              </h4>

              {queryResult && queryResult.rows.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs bg-white">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-mono uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        {Object.keys(queryResult.rows[0]).map((key) => (
                           <th key={key} className="px-4 py-2.5 font-bold">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {queryResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          {Object.values(row).map((val: any, tdIdx) => (
                            <td key={tdIdx} className="px-4 py-2.5">
                              {val === null || val === undefined ? (
                                <span className="text-slate-400 font-mono">NULL</span>
                              ) : typeof val === "boolean" ? (
                                val.toString()
                              ) : (
                                val
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400 bg-slate-50/50 border border-slate-200 border-dashed rounded-xl">
                  <Terminal className="w-6 h-6 text-slate-300 mb-1" />
                  <p className="text-xs">No result records found inside the buffer state.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentTab === "schema" && (
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-2xl">
            <div>
              <h4 className="text-sm font-bold text-slate-900">MySQL 8.0 Script (schema.sql)</h4>
              <p className="text-xs text-slate-550 leading-relaxed max-w-xl">
                Contains drop tables, schema configuration statements, composite unique indexes, check constraints, database rules, trigger rules, and initial values setup conforming exactly to the relational scheme.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(schemaText, "schema")}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-semibold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedText === "schema" ? <Check className="w-3.5 h-3.5 text-emerald-650" /> : <Copy className="w-3.5 h-3.5" />}
                Copy SQL Code
              </button>
              <a
                href="/api/schema-download"
                download="schema.sql"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Raw Download
              </a>
            </div>
          </div>

          <div className="relative bg-slate-900 border border-slate-950 p-4 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
            <pre className="text-xs font-mono text-emerald-450 leading-relaxed whitespace-pre pr-4">
              {schemaText || "Fetching schema.sql coding contents..."}
            </pre>
          </div>
        </div>
      )}

      {currentTab === "guide" && (
        <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto text-sm text-slate-700">
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              MySQL Integration & Deployment Guidelines
            </h4>
            <p className="text-xs text-slate-500">
              Follow these simple steps to replicate this exact setup with a local or production-hosted Cloud MySQL database instance.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-5 space-y-3">
              <h5 className="font-semibold text-blue-600 flex items-center gap-2 text-xs uppercase tracking-wider font-mono font-bold">
                <ChevronRight className="w-4 h-4 text-blue-600" /> Let's Setup MySQL Server
              </h5>
              <div className="pl-6 space-y-2 text-xs leading-relaxed text-slate-650">
                <p>
                  1. Download and install <strong>MySQL Community Server 8.0+</strong> locally, or provision a cloud database like <strong>Amazon RDS MySQL</strong> or <strong>Google Cloud SQL for MySQL</strong>.
                </p>
                <p>
                  2. Open your terminal or a database GUI tool (like MySQL Workbench, TablePlus, or DBeaver) and establish a root user connection.
                </p>
                <p>
                  3. Import the file <code className="bg-slate-100 border border-slate-200 text-slate-800 px-1 py-0.5 rounded text-[10px]">schema.sql</code>. It will automatically build the <code className="text-slate-900 font-bold">college_event_management</code> database, setup cascading foreign keys, compile constraints/triggers, and populate sample records!
                </p>
              </div>
            </div>

            <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-5 space-y-3">
              <h5 className="font-semibold text-blue-600 flex items-center gap-2 text-xs uppercase tracking-wider font-mono font-bold">
                <ChevronRight className="w-4 h-4 text-blue-600" /> Connect Express Backend to MySQL
              </h5>
              <div className="pl-6 space-y-2 text-xs leading-relaxed text-slate-655">
                <p>
                  1. In the root directory, install the popular Node-MySQL client:
                </p>
                <pre className="bg-slate-900 p-2 rounded border border-slate-950 font-mono text-emerald-400 text-[10px] w-full max-w-md">
                  npm install mysql2 dotenv
                </pre>
                <p>
                  2. Create a database config file <code className="text-slate-300 font-bold">/src/db-connector.ts</code>:
                </p>
                <pre className="bg-slate-900 p-3 rounded-xl border border-slate-950 font-mono text-emerald-450 text-[10px] overflow-x-auto whitespace-pre">
{`import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "college_event_management",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});`}
                </pre>
                <p>
                  3. Add the structural parameters in your <code className="bg-slate-900 text-emerald-400 px-1 py-0.5 rounded text-[10px]">.env</code> environment configurations:
                </p>
                <pre className="bg-slate-900 p-2 rounded border border-slate-950 font-mono text-emerald-440 text-[10px] w-full max-w-md">
{`DB_HOST=127.0.0.1
DB_USER=my_root_username
DB_PASSWORD=my_secure_password
DB_NAME=college_event_management`}
                </pre>
              </div>
            </div>

            <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-5 space-y-3">
              <h5 className="font-semibold text-blue-600 flex items-center gap-2 text-xs uppercase tracking-wider font-mono font-bold">
                <ChevronRight className="w-4 h-4 text-blue-600" /> Deploying The Platform to Production
              </h5>
              <div className="pl-6 space-y-2 text-xs leading-relaxed text-slate-655">
                <p>
                  <strong>Frontend Deployment:</strong> The React app is constructed as a static SPA. Compile your assets via <code className="text-slate-900 font-bold">npm run build</code> and host the resulting <code className="text-slate-920">dist/</code> folder on Vercel, Netlify, or Firebase Hosting.
                </p>
                <p>
                  <strong>Backend API Deployment:</strong> Deploy your Express script (<code className="text-slate-900 font-bold font-mono text-[10px]">server.ts</code> combined with node packages) to a Docker container via **Google Cloud Run**, Render, or Heroku.
                </p>
                <p>
                  <strong>Cloud Database Setup:</strong> Ensure your hosted app's outbound IP is permitted in your cloud database server configuration settings (e.g., MySQL whitelist / VPC settings) and inject real Connection URI credentials inside cloud portal environment config fields.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
