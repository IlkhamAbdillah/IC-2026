"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Tables } from "@/types/database.types";

import {
  SearchIcon,
  ArrowLeft,
  FileText,
  BarChart2,
  Users,
  Calendar,
  Clock,
} from "lucide-react";

export default function TestResultsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Tables<"tests">[]>([]);
  const [testResults, setTestResults] = useState<
    Record<
      number,
      {
        totalSessions: number;
        averageScore: number | null;
        completedSessions: number;
      }
    >
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTestsAndResults() {
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

      // Get all tests
      const { data: testsData, error: testsError } = await supabase
        .from("tests")
        .select("*")
        .order("created_at", { ascending: false });

      if (testsError) {
        setError("Failed to load tests");
        setIsLoading(false);
        return;
      }

      if (!testsData || testsData.length === 0) {
        setError("No tests found");
        setIsLoading(false);
        return;
      }

      setTests(testsData);

      // Get all test results data
      const resultsMap: Record<
        number,
        {
          totalSessions: number;
          averageScore: number | null;
          completedSessions: number;
        }
      > = {};

      // For each test, get statistics
      for (const test of testsData) {
        // Get test sessions for this test
        const { data: sessionData, error: sessionError } = await supabase
          .from("test_sessions")
          .select("id, status")
          .eq("test_id", test.id);

        if (sessionError) {
          console.error(
            `Error fetching sessions for test ${test.id}:`,
            sessionError
          );
          continue;
        }

        // Get scores for this test
        const { data: scoresData, error: scoresError } = await supabase
          .from("scores")
          .select("score")
          .eq("test_id", test.id);

        if (scoresError) {
          console.error(
            `Error fetching scores for test ${test.id}:`,
            scoresError
          );
          continue;
        }

        // Calculate average score
        const validScores = scoresData
          .filter((s) => s.score !== null)
          .map((s) => s.score as number);
        const averageScore =
          validScores.length > 0
            ? validScores.reduce((sum, score) => sum + score, 0) /
              validScores.length
            : null;

        // Count completed sessions
        const completedSessions = sessionData.filter(
          (s) => s.status === "finished"
        ).length;

        resultsMap[test.id] = {
          totalSessions: sessionData.length,
          averageScore,
          completedSessions,
        };
      }

      setTestResults(resultsMap);
      setIsLoading(false);
    }

    fetchTestsAndResults();
  }, [router]);

  const filteredTests = tests.filter(
    (test) =>
      test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (test.description?.toLowerCase() || "").includes(
        searchQuery.toLowerCase()
      )
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
              Test Results Overview
            </h1>
            <p className="text-muted-foreground">
              View performance data and insights for all your tests
            </p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden">
            {/* Search and filter */}
            <div className="p-6 border-b border-border/20">
              <div className="flex items-center bg-accent/30 rounded-lg px-3 py-2">
                <SearchIcon className="h-5 w-5 text-muted-foreground mr-2" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  className="bg-transparent border-none outline-none w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Tests list */}
            {filteredTests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-accent/30 rounded-xl border border-border/30 shadow-sm m-6">
                <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">No Tests Found</h3>
                <p className="text-muted-foreground max-w-md">
                  No tests found matching your search criteria.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 p-6">
                {filteredTests.map((test) => {
                  const testStats = testResults[test.id] || {
                    totalSessions: 0,
                    averageScore: null,
                    completedSessions: 0,
                  };

                  return (
                    <div
                      key={test.id}
                      className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden transition-all hover:shadow-lg"
                    >
                      <div className="p-6 border-b border-border/20">
                        <h2 className="text-xl font-semibold">{test.title}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {test.description || "No description"}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users size={16} className="text-primary" />
                            <span className="text-sm font-medium">
                              Total Participants
                            </span>
                          </div>
                          <p className="text-sm">{testStats.totalSessions}</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <BarChart2 size={16} className="text-primary" />
                            <span className="text-sm font-medium">
                              Average Score
                            </span>
                          </div>
                          <p className="text-sm">
                            {testStats.averageScore !== null
                              ? `${Math.round(testStats.averageScore)}%`
                              : "N/A"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText size={16} className="text-primary" />
                            <span className="text-sm font-medium">
                              Completion Rate
                            </span>
                          </div>
                          <p className="text-sm">
                            {testStats.totalSessions > 0
                              ? `${Math.round((testStats.completedSessions / testStats.totalSessions) * 100)}%`
                              : "N/A"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock size={16} className="text-primary" />
                            <span className="text-sm font-medium">
                              Duration
                            </span>
                          </div>
                          <p className="text-sm">
                            {test.duration
                              ? `${test.duration} mins`
                              : "Not set"}
                          </p>
                        </div>
                      </div>

                      <div className="p-6 bg-muted/30 border-t border-border/20 flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/cbt/results/${test.slug}/insights`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-indigo-600 to-indigo-500 hover:opacity-90 rounded-md shadow-sm transition-all"
                        >
                          <BarChart2 className="w-4 h-4 mr-1" />
                          View Insights
                        </Link>
                        <Link
                          href={`/admin/cbt/results/${test.slug}/leaderboard`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-secondary to-secondary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
                        >
                          View Leaderboard
                        </Link>
                        <Link
                          href={`/admin/cbt/results/${test.slug}`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
                        >
                          View Detailed Results
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
