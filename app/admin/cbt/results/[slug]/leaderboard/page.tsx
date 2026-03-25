"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
import { Tables } from "@/types/database.types";

import {
  ArrowLeft,
  Medal,
  Clock,
  Trophy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface TestSession extends Tables<"test_sessions"> {
  team: Tables<"teams"> | null;
  scores: Tables<"scores">[] | null;
}

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  score: number;
  completionTime: number; // in seconds
  rank: number;
}

function normalizeScore(scores: any) {
  if (!scores) return null;

  if (Array.isArray(scores)) {
    return scores
      .filter(s => s.created_at)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )[0] ?? null;
  }

  return scores;
}

export default function TestLeaderboardPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const [test, setTest] = useState<Tables<"tests"> | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(10); // Default to top 10 teams

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

      // Get completed test sessions with scores
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
        .eq("status", "finished"); // Only include finished sessions

      if (sessionsError) {
        setError("Failed to load test sessions");
        setIsLoading(false);
        return;
      }

      setSessions(sessionsData || []);
      generateLeaderboard(sessionsData || []);
      setIsLoading(false);
    }

    fetchTestResults();
  }, [params.slug, router]);

  // Generate the leaderboard data
  const generateLeaderboard = (sessionData: TestSession[]) => {
    const leaderboardData: LeaderboardEntry[] = sessionData
      .map((session) => {
        const scoreData = normalizeScore(session.scores);

        if (
          !session.team ||
          !scoreData ||
          scoreData.score === null ||
          !session.created_at ||
          !scoreData.created_at
        ) {
          return null;
        }

        const startTime = new Date(session.created_at).getTime();
        const finishTime = new Date(scoreData.created_at).getTime();
        const completionTime = (finishTime - startTime) / 1000;

        return {
          teamId: session.team_id,
          teamName: session.team?.name || "Unknown Team",
          score: scoreData.score as number,
          completionTime,
          rank: 0,
        };
      })
      .filter((x): x is LeaderboardEntry => x !== null);

    // Sort the leaderboard: primary by score (desc), secondary by completion time (asc)
    const sortedData = [...leaderboardData].sort((a, b) => {
      // Sort by score first (highest score first)
      const scoreDiff = b.score - a.score;

      // If scores are equal, sort by completion time (faster completion first)
      if (scoreDiff === 0) {
        return a.completionTime - b.completionTime;
      }

      return scoreDiff;
    });

    // Assign ranks
    sortedData.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    setLeaderboard(sortedData);
  };

  // Format seconds to minutes:seconds display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Medal colors for top 3
  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-yellow-500";
      case 2:
        return "text-gray-400";
      case 3:
        return "text-amber-700";
      default:
        return "text-muted-foreground";
    }
  };

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
            onClick={() => router.push(`/admin/cbt/results/${params.slug}`)}
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Test Results
          </button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            Leaderboard: {test.title}
          </h1>
          <p className="text-muted-foreground">
            Ranking the top performers by score and completion time
          </p>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Controls - only show limit control */}
        <div className="flex mb-6">
          <div className="flex items-center space-x-2">
            <label htmlFor="limit" className="text-sm font-medium">
              Show top:
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-border bg-accent/30 px-3 py-1 text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden border border-border/30">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Leaderboard Rankings
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (sorted by highest score, then fastest completion time)
              </span>
            </h2>

            {leaderboard.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No completed tests found. Leaderboard will appear when teams
                finish the test.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border/30">
                  <thead className="bg-muted/30">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16"
                      >
                        Rank
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Team
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Score
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Completion Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border/20">
                    {leaderboard.slice(0, limit).map((entry) => (
                      <tr
                        key={entry.teamId}
                        className={entry.rank <= 3 ? "bg-accent/10" : ""}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center w-8 h-8">
                            {entry.rank <= 3 ? (
                              <Medal
                                className={`h-6 w-6 ${getMedalColor(entry.rank)}`}
                              />
                            ) : (
                              <span className="text-muted-foreground font-mono">
                                {entry.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium">
                            {entry.teamName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold">
                            {entry.score}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                            {formatTime(entry.completionTime)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
