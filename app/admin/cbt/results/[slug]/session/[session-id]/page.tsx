"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
} from "lucide-react";
import { Tables } from "@/types/database.types";

interface QuestionWithChoices extends Tables<"questions"> {
  choices: Tables<"choices">[] | null;
}

interface AnswerWithQuestion {
  answer: Tables<"answers">;
  question: QuestionWithChoices | null;
  correction: Tables<"correction_table"> | null;
  isCorrect: boolean;
}

interface TestSessionDetails extends Tables<"test_sessions"> {
  team: Tables<"teams"> | null;
  test: Tables<"tests"> | null;
  score: Tables<"scores"> | null;
}

export default function SessionAnswersPage(props: {
  params: Promise<{ slug: string; "session-id": string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const [session, setSession] = useState<TestSessionDetails | null>(null);
  const [answers, setAnswers] = useState<AnswerWithQuestion[]>([]);
  const [debugLogs, setDebugLogs] = useState<Tables<"debug_logs">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [correctionsData, setCorrectionsData] = useState<
    Tables<"correction_table">[] | null
  >(null);
  const [filterType, setFilterType] = useState<
    "multiple-choices" | "short-answer" | null
  >(null);
  const [groupByType, setGroupByType] = useState(false);

  useEffect(() => {
    async function fetchSessionData() {
      setIsLoading(true);
      const supabase = await createClient();

      const {
        data: { session: authSession },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !authSession?.user) {
        router.push(
          "/sign-in?next=" + encodeURIComponent(window.location.pathname)
        );
        return;
      }

      // Get test session details
      const { data: sessionData, error: sessionError } = await supabase
        .from("test_sessions")
        .select(
          `
          *,
          team:team_id (*),
          test:test_id (*)
        `
        )
        .eq("id", params["session-id"])
        .single();

      if (sessionError) {
        setError("Failed to load test session details");
        setIsLoading(false);
        return;
      }

      // Get score for the session
      const { data: scoreData, error: scoreError } = await supabase
        .from("scores")
        .select("*")
        .eq("session_id", params["session-id"])
        .maybeSingle();

      if (scoreError) {
        console.error("Error fetching score:", scoreError);
      }

      // Combine session with score
      const sessionWithScore = {
        ...sessionData,
        score: scoreData,
      };

      setSession(sessionWithScore);

      // Get all answers for this session
      const { data: answersData, error: answersError } = await supabase
        .from("answers")
        .select("*")
        .eq("test_session_id", params["session-id"]);

      if (answersError) {
        setError("Failed to load answers");
        setIsLoading(false);
        return;
      }

      // Get debug logs
      const { data: logsData, error: logsError } = await supabase
        .from("debug_logs")
        .select("*")
        .eq("session_id", params["session-id"])
        .order("created_at", { ascending: true });

      if (logsError) {
        console.error("Error fetching debug logs:", logsError);
      } else {
        setDebugLogs(logsData || []);
      }

      // For each answer, get the corresponding question with choices and corrections
      const answersWithQuestions: AnswerWithQuestion[] = [];

      // Fetch all questions and corrections in batch
      const questionIds =
        answersData?.map((answer) => answer.question_id) || [];
      const choiceIds =
        answersData?.filter((a) => a.choice_id).map((a) => a.choice_id) || [];

      // Get all questions with their choices at once
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select(`*, choices(*)`)
        .in("id", questionIds);

      if (questionsError) {
        console.error("Error fetching questions:", questionsError);
      }

      // Get all corrections at once
      const { data: correctionsData, error: correctionsError } = await supabase
        .from("correction_table")
        .select("*");

      if (correctionsError) {
        console.error("Error fetching corrections:", correctionsError);
      }

      setCorrectionsData(correctionsData || []);

      // Process each answer with the batch-fetched data
      for (const answer of answersData || []) {
        const question =
          questionsData?.find((q) => q.id === answer.question_id) || null;

        // Find correction for this answer
        let correction = null;
        let isCorrect = false;

        if (answer.choice_id && correctionsData) {
          correction = correctionsData.find(
            (c) =>
              c.choice_id === answer.choice_id &&
              c.question_id === answer.question_id
          );
          isCorrect = !!correction;
        } else if (answer.answer_text && correctionsData) {
          correction = correctionsData.find(
            (c) =>
              c.question_id === answer.question_id &&
              c.answer_text &&
              answer.answer_text &&
              c.answer_text.toLowerCase() === answer.answer_text.toLowerCase()
          );
          isCorrect = !!correction;
        }

        answersWithQuestions.push({
          answer,
          question,
          correction,
          isCorrect,
        });
      }

      // Sort answers by question ID for a consistent order
      answersWithQuestions.sort(
        (a, b) => (a.question?.id || 0) - (b.question?.id || 0)
      );

      setAnswers(answersWithQuestions);
      setIsLoading(false);
    }

    fetchSessionData();
  }, [params, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/20 to-background/95">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary/20 to-background/95 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border/30">
            <p className="text-center text-red-600 dark:text-red-400">
              Test session not found
            </p>
            <button
              onClick={() => router.push(`/admin/cbt/results/${params.slug}`)}
              className="flex items-center mx-auto mt-4 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Test Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((a) => a.isCorrect).length;
  const incorrectAnswers = totalQuestions - correctAnswers;
  const score = session.score?.score ?? 0;
  const percentageScore =
    totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0;

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
          <h1 className="text-3xl font-bold tracking-tight">
            {session.team?.name || "Unknown Team"} - Test Results
          </h1>
          <p className="text-muted-foreground">
            {session.test?.title || "Unknown Test"}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Session Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="text-xl font-bold">
                  {session.start_time
                    ? new Date(session.start_time).toLocaleString()
                    : "Not started"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submission Time</p>
                <p className="text-xl font-bold">
                  {session.end_time
                    ? new Date(session.end_time).toLocaleString()
                    : "Not completed"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-xl font-bold capitalize">
                  {session.status || "Unknown"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Score Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <HelpCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Questions</p>
                <p className="text-xl font-bold">{totalQuestions}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Correct Answers</p>
                <p className="text-xl font-bold">{correctAnswers}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <XCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Incorrect Answers
                </p>
                <p className="text-xl font-bold">{incorrectAnswers}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-5 border border-border/30">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/10 p-3 mr-4">
                <HelpCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Score</p>
                <p className="text-xl font-bold">{score}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Answers */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden mb-6 border border-border/30">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Detailed Answers</h2>

            {/* Filter controls */}
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType(null)}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  filterType === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/30 hover:bg-accent/50 text-muted-foreground"
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setFilterType("multiple-choices")}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  filterType === "multiple-choices"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/30 hover:bg-accent/50 text-muted-foreground"
                }`}
              >
                Multiple Choice
              </button>
              <button
                onClick={() => setFilterType("short-answer")}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  filterType === "short-answer"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/30 hover:bg-accent/50 text-muted-foreground"
                }`}
              >
                Short Answer
              </button>

              <div className="ml-auto">
                <select
                  className="text-sm border rounded px-2 py-1 bg-background border-border"
                  value={groupByType ? "group" : "none"}
                  onChange={(e) => setGroupByType(e.target.value === "group")}
                >
                  <option value="none">No Grouping</option>
                  <option value="group">Group by Type</option>
                </select>
              </div>
            </div>

            <div className="space-y-8">
              {answers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No answers found for this session
                </p>
              ) : groupByType ? (
                // Grouped by question type
                Object.entries(
                  answers
                    .filter(
                      (item) =>
                        !filterType ||
                        item.question?.question_type === filterType
                    )
                    .reduce(
                      (groups, item) => {
                        const type = item.question?.question_type || "unknown";
                        if (!groups[type]) groups[type] = [];
                        groups[type].push(item);
                        return groups;
                      },
                      {} as Record<string, AnswerWithQuestion[]>
                    )
                ).map(([type, items]) => (
                  <div key={type} className="mb-8">
                    <h3 className="text-md font-medium mb-4 capitalize border-b pb-2">
                      {type.replace("-", " ")} Questions
                    </h3>
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div
                          key={item.answer.id}
                          className={`border rounded-lg overflow-hidden ${
                            item.isCorrect
                              ? "border-green-200 dark:border-green-800"
                              : "border-red-200 dark:border-red-800"
                          }`}
                        >
                          <div
                            className={`p-4 ${
                              item.isCorrect
                                ? "bg-green-50 dark:bg-green-900/20"
                                : "bg-red-50 dark:bg-red-900/20"
                            }`}
                          >
                            <div className="flex justify-between">
                              <h3 className="font-medium">
                                Question{" "}
                                {answers.findIndex(
                                  (a) => a.answer.id === item.answer.id
                                ) + 1}
                                :{" "}
                                <span className="font-normal">
                                  {item.question?.question_text &&
                                  item.question.question_text.length > 100
                                    ? `${item.question.question_text.substring(0, 100)}...`
                                    : item.question?.question_text ||
                                      "Unknown question"}
                                </span>
                              </h3>
                              <div
                                className={`flex items-center ${
                                  item.isCorrect
                                    ? "text-green-700 dark:text-green-400"
                                    : "text-red-700 dark:text-red-400"
                                }`}
                              >
                                {item.isCorrect ? (
                                  <>
                                    <CheckCircle className="w-5 h-5 mr-1" />
                                    <span>Correct</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-5 h-5 mr-1" />
                                    <span>Incorrect</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Points: {item.question?.points || 0} | Points
                              Earned:{" "}
                              {item.isCorrect ? item.question?.points : 0}
                            </div>
                          </div>
                          <div className="p-4 border-t border-border/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  Student Answer:
                                </h4>
                                {item.question?.question_type ===
                                "multiple-choices" ? (
                                  <div className="bg-accent/30 p-3 rounded border border-border/50">
                                    {item.answer.choice_id ? (
                                      item.question.choices?.find(
                                        (c) => c.id === item.answer.choice_id
                                      )?.choice_text || "Unknown choice"
                                    ) : (
                                      <span className="text-muted-foreground italic">
                                        No answer selected
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-accent/30 p-3 rounded border border-border/50">
                                    {item.answer.answer_text || (
                                      <span className="text-muted-foreground italic">
                                        No answer provided
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  Correct Answer:
                                </h4>
                                <div className="bg-accent/30 p-3 rounded border border-border/50">
                                  {item.question?.question_type ===
                                  "multiple-choices" ? (
                                    <>
                                      {item.question.choices
                                        ?.filter((choice) => {
                                          // Find any choice that has a matching correction record
                                          return correctionsData?.some(
                                            (c) =>
                                              c.choice_id === choice.id &&
                                              c.question_id ===
                                                item.question?.id
                                          );
                                        })
                                        .map((choice) => choice.choice_text)
                                        .join(", ") ||
                                        "No correct choice found"}
                                    </>
                                  ) : (
                                    // For text/other question types
                                    correctionsData
                                      ?.filter(
                                        (c) =>
                                          c.question_id === item.question?.id
                                      )
                                      .map((c) => c.answer_text)
                                      .join(", ") || "No correct answer found"
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Regular list (not grouped)
                answers
                  .filter(
                    (item) =>
                      !filterType || item.question?.question_type === filterType
                  )
                  .map((item) => (
                    <div
                      key={item.answer.id}
                      className={`border rounded-lg overflow-hidden ${
                        item.isCorrect
                          ? "border-green-200 dark:border-green-800"
                          : "border-red-200 dark:border-red-800"
                      }`}
                    >
                      <div
                        className={`p-4 ${
                          item.isCorrect
                            ? "bg-green-50 dark:bg-green-900/20"
                            : "bg-red-50 dark:bg-red-900/20"
                        }`}
                      >
                        <div className="flex justify-between">
                          <h3 className="font-medium">
                            Question{" "}
                            {answers.findIndex(
                              (a) => a.answer.id === item.answer.id
                            ) + 1}
                            :{" "}
                            <span className="font-normal">
                              {item.question?.question_text &&
                              item.question.question_text.length > 100
                                ? `${item.question.question_text.substring(0, 100)}...`
                                : item.question?.question_text ||
                                  "Unknown question"}
                            </span>
                          </h3>
                          <div
                            className={`flex items-center ${
                              item.isCorrect
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                          >
                            {item.isCorrect ? (
                              <>
                                <CheckCircle className="w-5 h-5 mr-1" />
                                <span>Correct</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 mr-1" />
                                <span>Incorrect</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Type: {item.question?.question_type || "Unknown"} |
                          Points: {item.question?.points || 0} | 
                          Points Earned: {
                            !item.answer.choice_id && !item.answer.answer_text
                              ? 0
                              : item.isCorrect
                                ? Number(item.question?.points || 0)
                                : -Number(item.question?.minus || 0)
                          }
                        </div>
                      </div>
                      <div className="p-4 border-t border-border/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Student Answer:
                            </h4>
                            {item.question?.question_type ===
                            "multiple-choices" ? (
                              <div className="bg-accent/30 p-3 rounded border border-border/50">
                                {item.answer.choice_id ? (
                                  item.question.choices?.find(
                                    (c) => c.id === item.answer.choice_id
                                  )?.choice_text || "Unknown choice"
                                ) : (
                                  <span className="text-muted-foreground italic">
                                    No answer selected
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="bg-accent/30 p-3 rounded border border-border/50">
                                {item.answer.answer_text || (
                                  <span className="text-muted-foreground italic">
                                    No answer provided
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Correct Answer:
                            </h4>
                            <div className="bg-accent/30 p-3 rounded border border-border/50">
                              {item.question?.question_type ===
                              "multiple-choices" ? (
                                <>
                                  {item.question.choices
                                    ?.filter((choice) => {
                                      // Find any choice that has a matching correction record
                                      return correctionsData?.some(
                                        (c) =>
                                          c.choice_id === choice.id &&
                                          c.question_id === item.question?.id
                                      );
                                    })
                                    .map((choice) => choice.choice_text)
                                    .join(", ") || "No correct choice found"}
                                </>
                              ) : (
                                // For text/other question types
                                correctionsData
                                  ?.filter(
                                    (c) => c.question_id === item.question?.id
                                  )
                                  .map((c) => c.answer_text)
                                  .join(", ") || "No correct answer found"
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Debug Information (toggleable) */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden mb-6 border border-border/30">
          <div
            className="p-4 cursor-pointer bg-accent/30 border-b border-border/20 flex justify-between items-center"
            onClick={() => setShowDebugInfo(!showDebugInfo)}
          >
            <h2 className="text-xl font-semibold">System Debug Information</h2>
            <button className="text-muted-foreground hover:text-foreground">
              {showDebugInfo ? "Hide" : "Show"}
            </button>
          </div>
          {showDebugInfo && (
            <div className="p-6 max-h-96 overflow-auto">
              <h3 className="text-md font-medium mb-3">
                Score Calculation Log
              </h3>
              {debugLogs.length === 0 ? (
                <p className="text-muted-foreground">No debug logs available</p>
              ) : (
                <div className="space-y-2">
                  {debugLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-border/50 rounded p-3 bg-accent/30"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">
                          {log.message}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString()
                            : "No timestamp"}
                        </span>
                      </div>
                      <pre className="text-xs overflow-auto p-2 bg-accent/50 rounded">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
