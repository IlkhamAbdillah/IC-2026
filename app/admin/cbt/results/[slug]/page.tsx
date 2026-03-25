"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  BarChart2,
} from "lucide-react";
import { Tables } from "@/types/database.types";

interface TestSession extends Tables<"test_sessions"> {
  team: Tables<"teams"> | null;
  scores: Tables<"scores">[] | null;
}

function getScore(scores: any): number | null {
  if (!scores) return null;
  return Array.isArray(scores)
    ? scores[0]?.score ?? null
    : scores.score ?? null;
}

function getSubmitTime(scores: any): string | null {
  if (!scores) return null;
  return Array.isArray(scores)
    ? scores[0]?.created_at ?? null
    : scores.created_at ?? null;
}

export default function TestResultDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const [test, setTest] = useState<Tables<"tests"> | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  }>({ key: "created_at", direction: "descending" });

  useEffect(() => {
    async function fetchTestResults() {
      setIsLoading(true);
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

      // Get test details
      const { data: testData, error: testError } = await supabase
        .from("tests")
        .select("*")
        .eq("slug", params.slug)
        .single();

      if (testError) {
        setError("Failed to load test details");
        setIsLoading(false);
        return;
      }

      setTest(testData);

      // Get test sessions with related data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("test_sessions")
        .select(
          `
          *,
          team:team_id (*),
          scores(*)
        `
        )
        .eq("test_id", testData.id)
        .order("created_at", { ascending: false });

      if (sessionsError) {
        setError("Failed to load test sessions");
        setIsLoading(false);
        return;
      }

      setSessions(sessionsData || []);
      setIsLoading(false);
    }

    fetchTestResults();
  }, [params.slug, router]);

  const handleSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    if (sortConfig.key === "score") {
      const scoreA = (a.scores && a.scores[0]?.score) || 0;
      const scoreB = (b.scores && b.scores[0]?.score) || 0;
      return sortConfig.direction === "ascending"
        ? scoreA - scoreB
        : scoreB - scoreA;
    } else if (sortConfig.key === "name") {
      const nameA = a.team?.name || "";
      const nameB = b.team?.name || "";
      return sortConfig.direction === "ascending"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    } else {
      // Default sort by date
      const dateA = new Date(a.created_at || "").getTime();
      const dateB = new Date(b.created_at || "").getTime();
      return sortConfig.direction === "ascending"
        ? dateA - dateB
        : dateB - dateA;
    }
  });

  const filteredSessions = sortedSessions.filter((session) => {
    const teamName = session.team?.name || "";
    const query = searchQuery.toLowerCase();

    return teamName.toLowerCase().includes(query);
  });

  // Calculate statistics
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(
    (s) => s.status === "finished"
  ).length;
  const completionRate = totalSessions
    ? Math.round((completedSessions / totalSessions) * 100)
    : 0;

  const validScores = sessions
    .filter((s) => s.scores && s.scores[0] && s.scores[0].score !== null)
    .map((s) => s.scores![0].score as number);

  const averageScore = validScores.length
    ? Math.round(
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      )
    : 0;

  const highestScore = validScores.length ? Math.max(...validScores) : 0;
  const lowestScore = validScores.length ? Math.min(...validScores) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/20 to-background/95">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary/20 to-background/95 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[80%] mx-auto">
          <div className="bg-card shadow-md rounded-lg p-6 border border-border/30">
            <p className="text-center text-red-600 dark:text-red-400">
              Test not found
            </p>
            <button
              onClick={() => router.push("/admin/cbt/results")}
              className="flex items-center mx-auto mt-4 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to All Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/20 to-background/95 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[80%] mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push("/admin/cbt/results")}
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to All Results
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {test.title}
              </h1>
              <p className="text-muted-foreground">
                {test.description || "No description available"}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() =>
                  router.push(`/admin/cbt/results/${params.slug}/insights`)
                }
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
              >
                View Insights
              </button>
              <button
                onClick={() =>
                  router.push(`/admin/cbt/results/${params.slug}/leaderboard`)
                }
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Participants
                </p>
                <p className="text-xl font-bold">{totalSessions}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <BarChart2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-xl font-bold">{averageScore}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-xl font-bold">{completionRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Test Duration</p>
                <p className="text-xl font-bold">
                  {test.duration || "N/A"} mins
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Score Distribution */}
          <div className="bg-card rounded-lg shadow-sm p-6 flex-1 border border-border/30">
            <h2 className="text-xl font-semibold mb-4">Score Distribution</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Highest Score
                  </span>
                  <span className="text-sm font-bold">{highestScore}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Average Score
                  </span>
                  <span className="text-sm font-bold">{averageScore}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Lowest Score
                  </span>
                  <span className="text-sm font-bold">{lowestScore}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Test Info */}
          <div className="bg-card rounded-lg shadow-sm p-6 flex-1 border border-border/30">
            <h2 className="text-xl font-semibold mb-4">Test Information</h2>
            <div className="space-y-3">
              <div className="flex items-start">
                <Calendar className="w-5 h-5 text-primary mr-2 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">
                    {new Date(test.created_at || "").toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <Clock className="w-5 h-5 text-primary mr-2 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium">
                    {test.duration || "N/A"} minutes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Results Table */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden mb-8 border border-border/30">
          <div className="p-6 border-b border-border/20">
            <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 bg-accent/30 rounded-lg px-3 py-2 mr-2">
                <input
                  type="text"
                  placeholder="Search teams..."
                  className="bg-transparent border-none outline-none w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  // Create CSV content
                  const headers = [
                    "Team",
                    "Score",
                    "Status",
                    "Date Started",
                    "Submit Time",
                    "Completion Time",
                  ];
                  const csvRows = [headers];

                  filteredSessions.forEach((session) => {
                    const score = getScore(session.scores);
                    const submitTime =
                      getSubmitTime(session.scores);
                    const status =
                      session.status === "finished"
                        ? "Completed"
                        : session.status === "ongoing"
                          ? "In Progress"
                          : "Not Started";

                    // Calculate completion time
                    let completionTime = "N/A";
                    if (submitTime && session.created_at) {
                      const startTime = new Date(session.created_at).getTime();
                      const endTime = new Date(submitTime).getTime();
                      const timeInMinutes = Math.round(
                        (endTime - startTime) / (1000 * 60)
                      );
                      completionTime = `${timeInMinutes} mins`;
                    }

                    csvRows.push([
                      session.team?.name || "Unknown Team",
                      score !== null && score !== undefined
                        ? `${score}`
                        : "Not completed",
                      status,
                      new Date(session.created_at || "").toLocaleString(),
                      submitTime
                        ? new Date(submitTime).toLocaleString()
                        : "Not submitted yet",
                      completionTime,
                    ]);
                  });

                  // Convert to CSV string
                  const csvContent = csvRows
                    .map((row) => row.join(","))
                    .join("\n");

                  // Create download link
                  const blob = new Blob([csvContent], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.setAttribute(
                    "download",
                    `${test?.title || "test"}_results.csv`
                  );
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-md shadow-sm transition-all"
              >
                Export to CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/30">
                <thead className="bg-muted/30">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("name")}
                    >
                      Team
                      {sortConfig.key === "name" && (
                        <span className="ml-1">
                          {sortConfig.direction === "ascending" ? "↑" : "↓"}
                        </span>
                      )}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("score")}
                    >
                      Score
                      {sortConfig.key === "score" && (
                        <span className="ml-1">
                          {sortConfig.direction === "ascending" ? "↑" : "↓"}
                        </span>
                      )}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort("created_at")}
                    >
                      Date Started
                      {sortConfig.key === "created_at" && (
                        <span className="ml-1">
                          {sortConfig.direction === "ascending" ? "↑" : "↓"}
                        </span>
                      )}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Submit Time
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Completion Time
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border/20">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-4 text-center text-sm text-muted-foreground"
                      >
                        No results found
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const score = getScore(session.scores);
                      const submitTime =
                        getSubmitTime(session.scores);

                      // Calculate completion time
                      let completionTime = "N/A";
                      if (
                        submitTime &&
                        session.created_at &&
                        session.status === "finished"
                      ) {
                        const startTime = new Date(
                          session.created_at
                        ).getTime();
                        const endTime = new Date(submitTime).getTime();
                        const timeInMinutes = Math.round(
                          (endTime - startTime) / (1000 * 60)
                        );
                        completionTime = `${timeInMinutes} mins`;
                      }

                      return (
                        <tr key={session.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">
                              {session.team?.name || "Unknown Team"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">
                              {score !== null && score !== undefined
                                ? `${score}`
                                : "Not completed"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                session.status === "finished"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : session.status === "ongoing"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400"
                              }`}
                            >
                              {session.status === "finished"
                                ? "Completed"
                                : session.status === "ongoing"
                                  ? "In Progress"
                                  : "Not Started"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(
                              session.created_at || ""
                            ).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {submitTime
                              ? new Date(submitTime).toLocaleString()
                              : "Not submitted yet"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {completionTime}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() =>
                                router.push(
                                  `/admin/cbt/results/${params.slug}/session/${session.id}`
                                )
                              }
                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
                              disabled={session.status !== "finished"}
                            >
                              View Answers
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
