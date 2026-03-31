"use client";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Tables } from "@/types/database.types";
import {
  SearchIcon,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  ClockIcon,
  CheckSquare,
  Square,
  RotateCw,
  MoreHorizontal,
} from "lucide-react";

type TestSession = Tables<"test_sessions"> & {
  team_name?: string;
  test_title?: string;
  overdue?: boolean;
  tests: {
    end_time?: string;
  };
};

export default function ForceSubmitPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      router.push(
        "/sign-in?next=" + encodeURIComponent(window.location.pathname)
      );
      return;
    }

    // Get all ongoing test sessions with joined teams and tests
    const { data, error: fetchError } = await supabase
      .from("test_sessions")
      .select(
        `
        *,
        teams (
          id,
          name
        ),
        tests (
          id,
          title,
          end_time
        )
      `
      )
      .eq("status", "ongoing");

    if (fetchError) {
      setError("Failed to load test sessions");
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setError("No ongoing test sessions found");
      setIsLoading(false);
      return;
    }

    // Transform data to include test title and team name
    const transformedData = data.map((session) => {
      const now = new Date();
      const startTime = new Date(session.start_time)
      const durationInMinutes = session.tests?.duration || 60;
      const durationDeadline = new Date(startTime.getTime() + durationInMinutes * 60000);

      const testEndTime = session.tests?.end_time 
        ? new Date(session.tests.end_time) 
        : durationDeadline;

      const effectiveEndTime = durationDeadline < testEndTime
        ? durationDeadline 
        : testEndTime;

      const isOverdue = now > effectiveEndTime;

      return {
        ...session,
        team_name: session.teams?.name || "Unknown Team",
        test_title: session.tests?.title || "Unknown Test",
        overdue: isOverdue,
      };
    });

    setSessions(transformedData);
    setIsLoading(false);
  }

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSessions.length === filteredSessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(filteredSessions.map((session) => session.id));
    }
  };

  const handleForceSubmit = async (sessionIds: string[]) => {
    if (!sessionIds.length) {
      setError("No sessions selected for submission");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    const supabase = await createClient();

    try {
      // Process each session one by one
      const results = await Promise.all(
        sessionIds.map(async (sessionId) => {
          const { data, error } = await supabase.rpc("manual_force_submit", {
            p_session_id: sessionId,
          });

          return { sessionId, success: !error, error };
        })
      );

      const failures = results.filter((r) => !r.success);

      if (failures.length === 0) {
        setSuccessMessage(
          `Successfully force-submitted ${sessionIds.length} session(s)`
        );
        // Refresh the sessions list
        fetchSessions();
      } else {
        setError(`Failed to submit ${failures.length} session(s)`);
        console.error("Submission failures:", failures);
      }
    } catch (err) {
      setError("An error occurred during submission");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceSubmitAll = async () => {
    const overdueSessionIds = sessions
      .filter((session) => session.overdue)
      .map((session) => session.id);

    if (overdueSessionIds.length === 0) {
      setError("No overdue sessions found");
      return;
    }

    handleForceSubmit(overdueSessionIds);
  };

  const filteredSessions = sessions.filter(
    (session) =>
      (session.team_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.test_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!filterOverdue || session.overdue)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/20 to-background/95">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 bg-gradient-to-b from-secondary/20 to-background/95 min-h-screen">
      <div className="w-full max-w-[80%] mx-auto px-4">
        <div className="flex flex-col gap-8">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Admin Dashboard
            </button>
            <h1 className="text-3xl font-bold tracking-tight">
              Force Submit Test Sessions
            </h1>
            <p className="text-muted-foreground">
              Force submit ongoing test sessions that are past their end time
            </p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4 inline mr-2" />
              {successMessage}
            </div>
          )}

          <div className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden">
            {/* Search and filter */}
            <div className="p-6 border-b border-border/20">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center bg-accent/30 rounded-lg px-3 py-2 flex-1">
                  <SearchIcon className="h-5 w-5 text-muted-foreground mr-2" />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    className="bg-transparent border-none outline-none w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center bg-accent/30 rounded-lg px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-2 accent-primary"
                      checked={filterOverdue}
                      onChange={() => setFilterOverdue(!filterOverdue)}
                    />
                    <span>Overdue only</span>
                  </label>
                  <button
                    onClick={fetchSessions}
                    className="bg-accent/30 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-muted/80 transition-colors"
                  >
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-6 border-b border-border/20">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleForceSubmit(selectedSessions)}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || selectedSessions.length === 0}
                >
                  {isSubmitting ? (
                    <RotateCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckSquare className="h-5 w-5" />
                  )}
                  Force Submit Selected ({selectedSessions.length})
                </button>
                <button
                  onClick={handleForceSubmitAll}
                  className="bg-destructive text-destructive-foreground rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-destructive/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    isSubmitting ||
                    sessions.filter((s) => s.overdue).length === 0
                  }
                >
                  <Clock className="h-5 w-5" />
                  Submit All Overdue ({sessions.filter((s) => s.overdue).length}
                  )
                </button>
              </div>
            </div>

            {/* Sessions list */}
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-accent/30 rounded-xl border border-border/30 shadow-sm m-6">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">No Sessions Found</h3>
                <p className="text-muted-foreground max-w-md">
                  No active test sessions found matching your search criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-6 py-3 text-left">
                        <div className="flex items-center">
                          <button
                            onClick={handleSelectAll}
                            className="h-5 w-5 flex items-center justify-center mr-2"
                          >
                            {selectedSessions.length ===
                              filteredSessions.length &&
                            filteredSessions.length > 0 ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          Session ID
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left">Test</th>
                      <th className="px-6 py-3 text-left">Team</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Start Time</th>
                      <th className="px-6 py-3 text-left">End Time</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filteredSessions.map((session) => (
                      <tr
                        key={session.id}
                        className={`${session.overdue ? "bg-red-50 dark:bg-red-900/10" : ""} hover:bg-muted/50 transition-colors`}
                      >
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center">
                            <button
                              onClick={() => handleSelectSession(session.id)}
                              className="h-5 w-5 flex items-center justify-center mr-2"
                            >
                              {selectedSessions.includes(session.id) ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                            <span className="font-mono">{session.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {session.test_title}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {session.team_name}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            {session.status}
                            {session.overdue && (
                              <span className="ml-1 text-xs bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {session.start_time
                            ? new Date(session.start_time).toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {session.tests?.end_time
                            ? new Date(session.tests.end_time).toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center">
                            <button
                              onClick={() => handleForceSubmit([session.id])}
                              className={`flex items-center gap-1 ${
                                session.overdue
                                  ? "text-primary hover:text-primary/70 font-medium"
                                  : "text-muted-foreground cursor-not-allowed opacity-60"
                              }`}
                              disabled={isSubmitting || !session.overdue}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {session.overdue ? "Submit" : "Not Overdue"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl shadow-md border border-border/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">All Sessions</h3>
              </div>
              <p className="text-3xl font-bold">{sessions.length}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Total ongoing test sessions
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-md border border-border/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <h3 className="text-lg font-semibold">Overdue</h3>
              </div>
              <p className="text-3xl font-bold">
                {sessions.filter((s) => s.overdue).length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Sessions past their end time
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-md border border-border/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">Selected</h3>
              </div>
              <p className="text-3xl font-bold">{selectedSessions.length}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Sessions selected for submission
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
