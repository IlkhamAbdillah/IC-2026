"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Tables } from "@/types/database.types";
import { createTestSession, calculateScore, getCachedTestBySlug, getCachedTestById, getCachedQuestions, getCachedChoices } from "@/lib/test-services";
import MDXContent from "@/components/cbt/MDXContent";
import QuestionSkeleton from "@/components/cbt/QuestionSkeleton";
import { useTheme } from "next-themes";
import { checkSessionValidity } from "@/app/actions";
import {
  Flag,
  FlagOff,
  FileQuestion,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  FileText,
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";

export default function TestPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const { slug } = useParams();
  const [test, setTest] = useState<Tables<"tests"> | null>(null);
  const [questions, setQuestions] = useState<Tables<"questions">[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [flags, setFlags] = useState<Tables<"flags">[]>([]);
  const [deadline, setDeadline] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoSubmitted = useRef(false);
  const [choices, setChoices] = useState<Tables<"choices">[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [teams, setTeams] = useState<Tables<"teams"> | null>(null);
  const [testSession, setTestSession] =
    useState<Tables<"test_sessions"> | null>(null);
  const [questionMD, setQuestionMD] = useState("");
  const [choicesMD, setChoicesMD] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shortAnswerValidationError, setShortAnswerValidationError] =
    useState("");
  const [shortAnswerSaved, setShortAnswerSaved] = useState(false);

  const supabase = createClient();

  const validateSession = async () => {
    try {
      const isValid = await checkSessionValidity(testSession!.id);

      if (!isValid) {
        router.push("/session-error");
        return;
      }
    } catch (error) {
      console.error("Error validating session:", error);
    }
  };

  useEffect(() => {
    // Handler to disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Handler to disable copy action
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Handler to intercept key presses (e.g., Ctrl+P or Cmd+P for printing)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the user pressed 'p' with Control or Meta key
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
      }
    };

    // Add event listeners for the desired actions
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("keydown", handleKeyDown);

    // Optionally, you can also disable the print dialog triggered by window.print()
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      return false;
    };
    window.addEventListener("beforeprint", handleBeforePrint);

    // Clean up event listeners on component unmount
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 key
      if (e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I or Cmd+Option+I for opening dev tools
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") ||
        (e.metaKey && e.altKey && e.key.toLowerCase() === "i")
      ) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+J or Cmd+Option+J for alternative dev tools shortcut
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") ||
        (e.metaKey && e.altKey && e.key.toLowerCase() === "j")
      ) {
        e.preventDefault();
        return false;
      }
      // Ctrl+U or Cmd+Option+U to view source
      if (
        (e.ctrlKey && e.key.toLowerCase() === "u") ||
        (e.metaKey && e.altKey && e.key.toLowerCase() === "u")
      ) {
        e.preventDefault();
        return false;
      }
    };

    // Disable context menu which might allow inspecting elements
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    async function initializeTest() {
      const jitterDelay = Math.floor(Math.random() * 5000);
      await new Promise((resolve) => setTimeout(resolve, jitterDelay));

      const { data: sessionData, error: authError } =
        await supabase.auth.getSession();

      if (authError) {
        router.push("/sign-in");
        return;
      }

      const { data: teams } = await supabase
        .from("members")
        .select("teams(*)")
        .eq("email", sessionData.session?.user.email)
        .single();

      const team = teams?.teams as unknown as Tables<"teams">;
      setTeams(team);

      const userRole = sessionData.session?.user.user_metadata?.role;
      const admin = userRole === "Admin";
      setIsAdmin(admin);

      let test: Tables<"tests"> | null = null;
      let testError = null;
      try {
        const cachedTest = await getCachedTestBySlug(slug as string);
        if (cachedTest) {
          if (!admin && !(cachedTest as any).ispublic) {
            testError = new Error("Test is not public");
          } else {
            test = cachedTest;
          }
        } else {
          testError = new Error("Not found");
        }
      } catch(e) { testError = e; }

      if (testError || !test) {
        console.error(testError || "Test not found or private");
        router.push("/cbt");
        return;
      }

      let session = {} as Tables<"test_sessions">;
      try {
        session = await createTestSession(team!.id, test!.id);
      } catch (error) {
        console.error(error);
        router.push("/cbt");
      }
      if (session.status === "finished") {
        const { data: scores } = await supabase
          .from("scores")
          .select("*")
          .eq("id", `${team?.id}-${test?.id}-${session.id}`)
          .single<Tables<"scores">>();

        if (scores) {
          router.push("/cbt");
        } else {
          await calculateScore(session.id, team!.id, test!.id);
          router.push("/cbt");
        }
        return;
      }
      setTestSession(session);

      // 2. Fetch test data and questions
      const testData = await getCachedTestById(session.test_id!);
      const questionsData = await getCachedQuestions(session.test_id!);

      if (testData && questionsData) {
        setTest(testData);
        // Create deterministic shuffle using seed from team ID and test ID
        const seedString = `${team.id}-${testData.id}`;
        // Create a simple hash from the seed string
        var seed = seedString
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Fisher-Yates shuffle with deterministic random using the seed
        const shuffledQuestions = [...questionsData];
        const randomGenerator = () => {
          // Simple linear congruential generator with our seed
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };

        for (let i = shuffledQuestions.length - 1; i > 0; i--) {
          const seededRandom = randomGenerator();
          const j = Math.floor(seededRandom * (i + 1));
          [shuffledQuestions[i], shuffledQuestions[j]] = [
            shuffledQuestions[j],
            shuffledQuestions[i],
          ];
        }

        setQuestions(shuffledQuestions);

        // 1. Ambil durasi dari data test (asumsi dalam menit, ubah ke milidetik)
        const testDurationMs = testData.duration! * 60 * 1000; 
        const sessionStartTime = new Date(session.start_time!).getTime();
        const durationDeadline = sessionStartTime + testDurationMs;
        const absoluteDeadline = new Date(testData.end_time!).getTime();
        const actualDeadline = Math.min(durationDeadline, absoluteDeadline);
        const remainingSeconds = Math.floor((actualDeadline - Date.now()) / 1000);

        setTimeRemaining(remainingSeconds > 0 ? remainingSeconds : 0);
        setDeadline(actualDeadline);

        const syncTimer = setInterval(async () => {
          try {
            const response = await fetch(
              `/api/check-time?testId=${testData.id}`
            );
            const { serverTimeRemaining } = await response.json();
            console.log("Server time remaining:", serverTimeRemaining);

            if (Math.abs(serverTimeRemaining - timeRemaining) > 2) {
              setTimeRemaining(serverTimeRemaining);
            }
          } catch (error) {
            console.error("Failed to sync time with server:", error);
          }
        }, 1800000);

        return () => {
          clearInterval(syncTimer);
        };
      }
    }

    initializeTest();
  }, [router]);

  const fetchTestSession = async () => {
    if (!test || !teams) return;
    let session = {} as Tables<"test_sessions">;
    try {
      session = await createTestSession(teams!.id, test!.id);
    } catch (error) {
      console.error(error);
      router.push("/cbt");
    }
    if (session.status === "finished") {
      const { data: scores } = await supabase
        .from("scores")
        .select("*")
        .eq("id", `${teams?.id}-${test?.id}-${session.id}`)
        .single<Tables<"scores">>();

      if (scores) {
        router.push("/cbt");
      } else {
        await calculateScore(session.id, teams!.id, test!.id);
        router.push("/cbt");
      }
      router.push("/cbt");
      return;
    }
    setTestSession(session);
  };

  useEffect(() => {
    fetchTestSession();
  }, [test, teams, router]);

  // Validate session every 1 minute instead of every question click
  useEffect(() => {
    if (!testSession) return;
    const sessionCheckInterval = setInterval(() => {
      validateSession();
    }, 1 * 60 * 1000); // 1 menit

    return () => clearInterval(sessionCheckInterval);
  }, [testSession]);

  // Handle question change when questions state updates
  useEffect(() => {
    if (questions.length > 0) {
      handleQuestionChange(0);
    }
  }, [questions]);

  useEffect(() => {
    if (!deadline) return;

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    updateRemaining();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(updateRemaining, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [deadline]);

  useEffect(() => {
    if (timeRemaining === 0 && deadline > 0 && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      submitTest();
    }
  }, [timeRemaining, deadline]);

  const handleFlag = async () => {
    // fetchTestSession dihapus — data sesi sudah tersimpan di state

    const { data } = await supabase
      .from("flags")
      .select()
      .textSearch("id", `${testSession?.id}-${teams?.id}`);

    setFlags(data ?? []);

    if (data!.length > 0) {
      const isFlagged = flags.find(
        (flag) =>
          flag.id ===
          `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`
      );
      if (isFlagged) {
        await supabase
          .from("flags")
          .delete()
          .eq(
            "id",
            `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`
          );
        setFlags(
          flags.filter(
            (flag) =>
              flag.id !==
              `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`
          )
        );
      } else {
        await supabase.from("flags").upsert({
          id: `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`,
          team_id: teams?.id,
        });
        setFlags([
          ...flags,
          {
            id: `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`,
            team_id: teams!.id,
          },
        ]);
      }
      return;
    }

    const { error } = await supabase.from("flags").upsert({
      id: `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`,
      team_id: teams?.id,
    });

    if (error) {
      console.error(error);
      return;
    }

    setFlags([
      ...flags,
      {
        id: `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`,
        team_id: teams!.id,
      },
    ]);
  };

  const validateInput = (value: string, pattern: string | RegExp) => {
    const regex = new RegExp(pattern);

    if (!regex.test(value)) {
      setShortAnswerValidationError("Input doesn't match the required format");
      return false;
    } else {
      setShortAnswerValidationError("");
      return true;
    }
  };

  const handleAnswer = async (
    questionId: number,
    choices: Tables<"choices">
  ) => {
    // fetchTestSession dihapus — data sesi sudah tersimpan di state
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choices.id,
    }));

    // Save answer to database
    const supabase = createClient();
    await supabase.from("answers").upsert({
      id: `${testSession?.id}-${questionId}`,
      test_session_id: testSession?.id,
      question_id: questionId,
      test_id: test?.id,
      choice_id: choices.id,
      answer_text: choices.choice_text,
      team_id: teams?.id,
      timestamp: new Date().toISOString(),
    });
  };

  const handleShortAnswer = async (questionId: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));

    // Save answer to database
    const supabase = createClient();
    await supabase.from("answers").upsert({
      id: `${testSession?.id}-${questionId}`,
      test_id: test?.id,
      test_session_id: testSession?.id,
      question_id: questionId,
      answer_text: answer,
      team_id: teams?.id,
      timestamp: new Date().toISOString(),
    });

    setShortAnswerSaved(true);
  };

  const handleDeleteAnswer = async (questionId: number) => {
    // Remove answer from local state
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });

    // Reset short answer saved state if applicable
    if (questions[currentQuestion].question_type === "short-answer") {
      setShortAnswerSaved(false);
    }

    // Delete from database
    const supabase = createClient();
    await supabase.from("answers").delete().match({
      test_session_id: testSession?.id,
      question_id: questionId,
      team_id: teams?.id,
    });
  };

  const handleQuestionChange = async (index: number) => {
    // validateSession dipindahkan ke timer 5 menit (bukan per-klik)
    // fetchTestSession dihapus — data sesi sudah tersimpan di state
    setShortAnswerSaved(false);
    setCurrentQuestion(index);

    // Cek apakah jawaban sudah ada di local state (optimistic)
    if (answers[questions[index].id]) {
      setShortAnswerSaved(true);
    }

    setLoading(true);

    const questionType = questions[index].question_type;
    if (
      questionType === "multiple-choices" ||
      questionType === "multiple-answers"
    ) {
      const choicesData = await getCachedChoices(questions[index].id);

      // Create deterministic shuffle using seed from test session ID
      const seedString = testSession?.id || "";
      // Create a simple hash from the seed string
      let choiceSeed = seedString
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);

      // Fisher-Yates shuffle with deterministic random using the seed
      const shuffledChoices = [...choicesData];
      const choiceRandomGenerator = () => {
        // Simple linear congruential generator with our seed
        choiceSeed = (choiceSeed * 9301 + 49297) % 233280;
        return choiceSeed / 233280;
      };

      for (let i = shuffledChoices.length - 1; i > 0; i--) {
        const seededRandom = choiceRandomGenerator();
        const j = Math.floor(seededRandom * (i + 1));
        [shuffledChoices[i], shuffledChoices[j]] = [
          shuffledChoices[j],
          shuffledChoices[i],
        ];
      }

      setChoices(shuffledChoices);

      let choicesResponses = [];
      for (const choice of shuffledChoices) {
        choicesResponses.push(choice.choice_mdx!);
      }

      setChoicesMD(choicesResponses);
    } else if (questionType === "short-answer") {
      setChoices([]);
    }

    setQuestionMD(questions[index].question_mdx!);

    const { data: flagged } = await supabase
      .from("flags")
      .select()
      .textSearch("id", `${testSession?.id}-${teams?.id}`);

    setFlags(flagged ?? []);
    setLoading(false);
  };

  const handleSubmitModal = () => {
    setShowSubmitModal(true);
  };

  const handleCloseModal = () => {
    setShowSubmitModal(false);
  };

  const submitTest = async () => {
    if (!testSession) return;

    const supabase = createClient();

    // Update test session
    const { error } = await supabase
      .from("test_sessions")
      .update({
        status: "finished",
        end_time: new Date().toISOString(),
        answers: answers,
      })
      .eq("id", testSession.id);

    if (error) {
      console.error(error);
    }

    await calculateScore(testSession.id, teams!.id, test!.id);

    router.push(`/cbt`);
  };

  // Format remaining time
  const formatTime = (seconds: number) => {
    const hour = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsLeft = seconds % 60;
    return `${hour.toString().padStart(2, "0")} hours ${minutes.toString().padStart(2, "0")} minutes ${secondsLeft.toString().padStart(2, "0")} seconds`;
  };

  if (!test || !questions.length || loading) {
    return <QuestionSkeleton />;
  }

  return (
    <div className="w-full py-8 bg-gradient-to-b from-secondary/20 to-background/95 min-h-screen mx-auto">
      {/* Main Quiz Container */}
      <div className="w-full max-w-[90%] mx-auto rounded-xl overflow-hidden shadow-lg">
        {/* Timer and Navigation Block */}
        <div className="bg-gradient-to-r from-background to-background/95 p-5 rounded-t-xl border-b border-border/30">
          <div className="flex justify-between items-center">
            <div className="text-foreground font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span>Time Remaining: {formatTime(timeRemaining)}</span>
            </div>
            <div className="text-foreground/80 bg-muted px-3 py-1 rounded-full text-sm font-medium">
              Question {currentQuestion + 1} of {questions.length}
            </div>
          </div>
        </div>

        {/* Main Content with Sidebar Layout */}
        <div className="flex flex-col md:flex-row">
          {/* Question Navigation - Left Sidebar */}
          <div className="w-full md:w-[20%] bg-background/90 p-4 border-r border-border/30">
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {questions.map((_, index) => (
                <button
                  key={index}
                  className={`w-full aspect-square p-3 relative rounded-lg border flex items-center justify-center ${
                    index === currentQuestion
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md"
                      : answers[questions[index].id]
                        ? "bg-accent/45 text-foreground border-accent/40"
                        : "bg-background border-border/50 text-foreground/80"
                  } hover:bg-primary/50 hover:text-primary-foreground transition-all duration-200`}
                  onClick={() => handleQuestionChange(index)}
                >
                  {flags.find(
                    (flag) =>
                      flag.id ===
                      `${testSession?.id}-${teams?.id}-${questions[index].id}`
                  ) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background"></div>
                  )}
                  <span className="text-sm font-medium">{index + 1}</span>
                </button>
              ))}
            </div>
            {/* Notice about question clarification */}
            <div className="mt-6 p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80">
                  Anda dapat meminta klarifikasi soal hingga 30 menit setelah
                  memulai ujian
                </p>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="w-full md:w-[80%] bg-gradient-to-b from-background to-background/98 p-6 sm:p-8 rounded-b-xl shadow-inner">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl text-foreground font-semibold flex items-center gap-2">
                <FileQuestion className="h-5 w-5 text-primary" />
                Question {currentQuestion + 1}
              </h2>
              <button
                className={`p-2 rounded-full transition-colors ${
                  flags.find(
                    (flag) =>
                      flag.id ===
                      `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`
                  )
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={handleFlag}
              >
                {flags.find(
                  (flag) =>
                    flag.id ===
                    `${testSession?.id}-${teams?.id}-${questions[currentQuestion].id}`
                ) ? (
                  <Flag className="h-5 w-5" />
                ) : (
                  <FlagOff className="h-5 w-5" />
                )}
              </button>
            </div>

            <div
              className="max-w-none mb-8 markdown-body text-foreground bg-custom p-6 rounded-lg border border-border shadow-sm"
              data-theme={theme}
              style={{ colorScheme: theme }}
            >
              {questionMD ? (
                <MDXContent code={questionMD} />
              ) : (
                questions[currentQuestion].question_text
              )}
            </div>

            {/* Answer Options */}
            <div className="space-y-3 mt-6">
              {questions[currentQuestion].question_type === "short-answer" ? (
                <div className="bg-card/50 p-3 rounded-lg border border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answers[questions[currentQuestion].id] || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === answers[questions[currentQuestion].id]) {
                          setShortAnswerSaved(true);
                        } else {
                          setShortAnswerSaved(false);
                        }
                        // Only validate on input, but don't save
                        validateInput(
                          value,
                          questions[currentQuestion].validation_pattern || ".*" // Fallback to any input if no pattern specified
                        );
                        // Store temporarily in state without saving to database
                        setAnswers((prev) => ({
                          ...prev,
                          [questions[currentQuestion].id]: value,
                        }));
                      }}
                      className={`w-full p-3 bg-custom border ${
                        shortAnswerValidationError
                          ? "border-red-500 focus:ring-red-500"
                          : "border-input focus:ring-primary/50 focus:border-primary"
                      } rounded-lg focus:ring-2 outline-none transition-all`}
                      placeholder="Type your answer here..."
                    />
                    <button
                      onClick={() => {
                        const value =
                          answers[questions[currentQuestion].id] || "";
                        if (
                          validateInput(
                            value,
                            questions[currentQuestion].validation_pattern ||
                              ".*"
                          )
                        ) {
                          handleShortAnswer(
                            questions[currentQuestion].id,
                            value
                          );
                        }
                      }}
                      className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium ${
                        shortAnswerSaved
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-primary text-primary-foreground hover:bg-primary/50"
                      }`}
                    >
                      {shortAnswerSaved ? "Saved" : "Save"}
                      {shortAnswerSaved ? (
                        <Check className="h-4 w-4 animate-pulse" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    {answers[questions[currentQuestion].id] && (
                      <button
                        onClick={() =>
                          handleDeleteAnswer(questions[currentQuestion].id)
                        }
                        className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-2 font-medium"
                      >
                        Clear
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {shortAnswerValidationError && (
                    <p className="text-red-500 text-sm mt-1">
                      {shortAnswerValidationError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-card/50 p-3 rounded-lg border border-border/30">
                  {answers[questions[currentQuestion].id] && (
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() =>
                          handleDeleteAnswer(questions[currentQuestion].id)
                        }
                        className="px-3 py-1 rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-all flex items-center gap-1 text-sm font-medium"
                      >
                        Clear Selection
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {choices.map((choice, index) => (
                    <label
                      key={index}
                      className={`flex items-center space-x-3 p-4 rounded-lg mb-2 last:mb-0 cursor-pointer transition-colors ${
                        answers[questions[currentQuestion].id] === choice.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center ${
                          answers[questions[currentQuestion].id] === choice.id
                            ? "border-primary bg-primary/20"
                            : "border-muted-foreground"
                        }`}
                      >
                        {answers[questions[currentQuestion].id] ===
                          choice.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                        )}
                      </div>
                      <input
                        type="radio"
                        name={`question-${questions[currentQuestion].id}`}
                        value={choice.id}
                        checked={
                          answers[questions[currentQuestion].id] === choice.id
                        }
                        onChange={() =>
                          handleAnswer(questions[currentQuestion].id, choice)
                        }
                        className="sr-only"
                      />
                      <span className="markdown-body flex-grow">
                        {choicesMD[index] ? (
                          <MDXContent code={choicesMD[index]} />
                        ) : (
                          choice.choice_text
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() =>
                  handleQuestionChange(Math.max(0, currentQuestion - 1))
                }
                disabled={currentQuestion === 0}
                className="px-6 py-3 bg-background text-foreground rounded-lg border border-border flex items-center gap-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {currentQuestion === questions.length - 1 ? (
                <button
                  onClick={handleSubmitModal}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center gap-2 font-medium shadow-md"
                >
                  Submit Test
                  <Send className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() =>
                    handleQuestionChange(
                      Math.min(questions.length - 1, currentQuestion + 1)
                    )
                  }
                  className="px-6 py-3 bg-background text-foreground rounded-lg border border-border flex items-center gap-2 hover:bg-muted transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Submit Modal */}
            {showSubmitModal && (
              <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-background p-6 rounded-xl shadow-xl w-full max-w-2xl border border-border/50">
                  <h3 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    Confirm Submission
                  </h3>

                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-foreground/80">
                      Test Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-muted to-muted/80 p-4 rounded-lg shadow-sm border border-border/20">
                        <p className="text-foreground/70 font-medium text-sm mb-1">
                          Answered Questions
                        </p>
                        <p className="text-2xl font-bold text-foreground flex items-end gap-1">
                          <span>{Object.keys(answers).length}</span>
                          <span className="text-base text-foreground/60 font-normal">
                            / {questions.length}
                          </span>
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-muted to-muted/80 p-4 rounded-lg shadow-sm border border-border/20">
                        <p className="text-foreground/70 font-medium text-sm mb-1">
                          Flagged Questions
                        </p>
                        <p className="text-2xl font-bold text-foreground flex items-center">
                          {flags.length}
                          {flags.length > 0 && (
                            <Flag className="h-4 w-4 ml-1 text-destructive" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-foreground/80">
                      Question Status
                    </h4>
                    <div className="max-h-60 overflow-y-auto p-2 border rounded-lg bg-card/50">
                      {questions.map((question, index) => (
                        <div
                          key={index}
                          className="flex items-center py-2 px-3 border-b last:border-b-0 hover:bg-muted/50 rounded-md transition-colors"
                        >
                          <span className="mr-3 bg-muted w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium">
                            {index + 1}
                          </span>
                          {answers[question.id] ? (
                            <span className="text-green-600 dark:text-green-400 font-medium flex items-center">
                              <Check className="h-4 w-4 mr-1" /> Answered
                            </span>
                          ) : (
                            <span className="text-red-500 font-medium flex items-center">
                              <X className="h-4 w-4 mr-1" /> Not answered
                            </span>
                          )}
                          {flags.find(
                            (flag) =>
                              flag.id ===
                              `${testSession?.id}-${teams?.id}-${question.id}`
                          ) && (
                            <span className="ml-auto text-destructive flex items-center">
                              <Flag size={14} className="mr-1" /> Flagged
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm text-primary mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span>
                      Are you sure you want to submit? Once submitted, you
                      cannot return to this test.
                    </span>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitTest}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-70 shadow-md flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full mr-1"></span>
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Test
                          <Send className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
