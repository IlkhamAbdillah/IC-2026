// "use client";

// import { useEffect, useReducer, useCallback, useRef } from "react";
// import { useRouter, useParams } from "next/navigation";
// import { useTheme } from "next-themes";
// import { testReducerExam, initialState } from "@/reducers/testReducer";
// import { createTestSession, calculateScore } from "@/lib/test-services";
// import { createClient } from "@/utils/supabase/client";
// import MDXContent from "@/components/cbt/MDXContent";
// import QuestionSkeleton from "@/components/cbt/QuestionSkeleton";
// import { Tables } from "@/types/database.types";
// import { checkSessionValidity } from "@/app/actions";
// import { testService } from "@/services/testService";
// import {
//   Flag,
//   FlagOff,
//   FileQuestion,
//   Clock,
//   ChevronLeft,
//   ChevronRight,
//   Send,
//   AlertCircle,
//   Check,
//   X,
//   AlertTriangle,
//   Trash2,
//   Users,
//   RefreshCw,
// } from "lucide-react";
// import { toast } from "sonner";

// // Create a service for fetching team data
// const teamService = {
//   async fetchTeamAnswers(teamId: string, sessionId: string, supabase: any) {
//     const { data, error } = await supabase
//       .from("answers")
//       .select("*")
//       .eq("team_id", teamId)
//       .eq("test_session_id", sessionId);

//     if (error) throw error;
//     return data;
//   },

//   async fetchTeamFlags(sessionId: string, teamId: string, supabase: any) {
//     const { data, error } = await supabase
//       .from("flags")
//       .select()
//       .textSearch("id", `${sessionId}-${teamId}`);

//     if (error) throw error;
//     return data || [];
//   },
// };

// export default function TestPage() {
//   const { theme } = useTheme();
//   const router = useRouter();
//   const { slug } = useParams();
//   const [state, dispatch] = useReducer(testReducerExam, initialState);
//   const supabase = createClient();

//   // Refs to manage timers and polling
//   const timerRef = useRef<NodeJS.Timeout | null>(null);
//   const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const lastSyncRef = useRef<number>(Date.now());
//   const lastAnswersHashRef = useRef<string>("");
//   const lastFlagsHashRef = useRef<string>("");
//   const isSyncingRef = useRef<boolean>(false);
//   const manualSyncRequestedRef = useRef<boolean>(false);

//   // Helper to generate a simple hash of data for comparison
//   const generateHash = (data: any): string => {
//     return JSON.stringify(data);
//   };

//   // Helper to check if a flag exists
//   const isQuestionFlagged = useCallback(
//     (questionId: number) => {
//       return state.flags.some(
//         (flag) =>
//           flag.id ===
//           `${state.testSession?.id}-${state.teams?.id}-${questionId}`
//       );
//     },
//     [state.flags, state.testSession, state.teams]
//   );

//   // Validate session
//   const validateSession = async () => {
//     try {
//       const isValid = await checkSessionValidity(state.testSession?.id);
//       if (!isValid) {
//         router.push("/session-error");
//         return;
//       }
//     } catch (error) {
//       console.error("Error validating session:", error);
//     }
//   };

//   // Initialize test and load questions
//   useEffect(() => {
//     async function initializeTest() {
//       dispatch({ type: "SET_LOADING", payload: true });

//       try {
//         // Auth check
//         const { data: sessionData, error: authError } =
//           await supabase.auth.getSession();
//         if (authError) {
//           router.push("/sign-in");
//           return;
//         }

//         // Get team info
//         const { data: teamData } = await supabase
//           .from("members")
//           .select("teams(*)")
//           .eq("email", sessionData.session?.user.email)
//           .single();

//         const team = teamData?.teams as unknown as Tables<"teams">;
//         if (!team) {
//           toast.error("Team not found");
//           router.push("/cbt");
//           return;
//         }

//         // Set team state
//         dispatch({ type: "SET_TEAM", payload: team });

//         // Get test data
//         const test = await testService.fetchTestBySlug(slug as string);
//         dispatch({ type: "SET_TEST", payload: test });

//         // Create or get test session
//         let session;
//         try {
//           session = await createTestSession(team.id, test.id);
//         } catch (error) {
//           console.error(error);
//           toast.error("Error creating test session");
//           router.push("/cbt");
//           return;
//         }

//         // Check if test is already finished
//         if (session.status === "finished") {
//           const { data: scores } = await supabase
//             .from("scores")
//             .select("*")
//             .eq("id", `${team.id}-${test.id}-${session.id}`)
//             .single<Tables<"scores">>();

//           if (!scores) {
//             await calculateScore(session.id, team.id, test.id);
//           }

//           router.push("/cbt");
//           return;
//         }

//         // Set session state
//         dispatch({ type: "SET_SESSION", payload: session });

//         // Get questions
//         const questions = await testService.fetchQuestionsByTestId(test.id);

//         // Shuffle questions deterministically
//         const shuffledQuestions = shuffleQuestions(
//           questions,
//           `${team.id}-${test.id}`
//         );
//         dispatch({ type: "SET_QUESTIONS", payload: shuffledQuestions });

//         // Initialize timer management - KEEPING ORIGINAL TIMER LOGIC
//         const endTime = new Date(test.end_time!).getTime();
//         const initialTimeRemaining = Math.floor((endTime - Date.now()) / 1000);
//         dispatch({ type: "SET_TIME_REMAINING", payload: initialTimeRemaining });

//         // Start timer
//         if (timerRef.current) clearInterval(timerRef.current);
//         timerRef.current = setInterval(() => {
//           dispatch((prevState) => {
//             const newTime = prevState.timeRemaining - 1;
//             if (newTime <= 0) {
//               if (timerRef.current) clearInterval(timerRef.current);
//               submitTest();
//               return prevState;
//             }
//             return { ...prevState, timeRemaining: newTime };
//           });
//         }, 1000);

//         // Set up timer sync with server
//         if (syncTimerRef.current) clearInterval(syncTimerRef.current);
//         syncTimerRef.current = setInterval(async () => {
//           try {
//             const response = await fetch(`/api/check-time?testId=${test.id}`);
//             const { serverTimeRemaining } = await response.json();
//             console.log("Server time remaining:", serverTimeRemaining);

//             dispatch((prevState) => {
//               if (Math.abs(serverTimeRemaining - prevState.timeRemaining) > 2) {
//                 return { ...prevState, timeRemaining: serverTimeRemaining };
//               }
//               return prevState;
//             });
//           } catch (error) {
//             console.error("Failed to sync time with server:", error);
//           }
//         }, 1800000); // 30 minutes

//         // Set up polling for team updates
//         setupTeamUpdatePolling();

//         // Load first question
//         if (shuffledQuestions.length > 0) {
//           handleQuestionChange(0);
//         }
//       } catch (error) {
//         console.error("Error initializing test:", error);
//         toast.error("Failed to load test");
//       } finally {
//         dispatch({ type: "SET_LOADING", payload: false });
//       }
//     }

//     initializeTest();

//     // Cleanup function
//     return () => {
//       if (timerRef.current) clearInterval(timerRef.current);
//       if (syncTimerRef.current) clearInterval(syncTimerRef.current);
//       if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
//     };
//   }, [router, slug]);

//   // Set up polling for team updates
//   const setupTeamUpdatePolling = () => {
//     if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

//     // Poll for updates every 5 seconds
//     pollingTimerRef.current = setInterval(async () => {
//       await checkForTeamUpdates();
//     }, 5000);
//   };

//   // Function to check for team updates
//   const checkForTeamUpdates = async (force = false) => {
//     if (
//       !state.testSession?.id ||
//       !state.teams?.id ||
//       (isSyncingRef.current && !force)
//     )
//       return;

//     isSyncingRef.current = true;
//     const isManualSync = force || manualSyncRequestedRef.current;

//     try {
//       // Fetch team answers
//       const teamAnswers = await teamService.fetchTeamAnswers(
//         state.teams.id,
//         state.testSession.id,
//         supabase
//       );

//       const answersHash = generateHash(teamAnswers);

//       if (answersHash !== lastAnswersHashRef.current) {
//         // Convert to the format we need
//         const answersMap = teamAnswers.reduce(
//           (acc, curr) => {
//             acc[curr.question_id] = curr.choice_id ?? curr.answer_text;
//             return acc;
//           },
//           {} as Record<string, any>
//         );

//         dispatch({ type: "SET_ANSWERS", payload: answersMap });

//         // Check if current question is already answered
//         if (
//           state.questions.length > 0 &&
//           answersMap[state.questions[state.currentQuestion].id]
//         ) {
//           dispatch({ type: "SET_SHORT_ANSWER_SAVED", payload: true });
//         }

//         lastAnswersHashRef.current = answersHash;

//         // Only show notification if it's not a manual sync and if data actually changed
//         if (!isManualSync && Object.keys(state.answers).length > 0) {
//           toast.info("Team answers synchronized", { id: "team-sync" });
//         }
//       }

//       // Fetch team flags
//       const flags = await teamService.fetchTeamFlags(
//         state.testSession.id,
//         state.teams.id,
//         supabase
//       );

//       const flagsHash = generateHash(flags);

//       if (flagsHash !== lastFlagsHashRef.current) {
//         dispatch({ type: "SET_FLAGS", payload: flags });
//         lastFlagsHashRef.current = flagsHash;

//         // Only show notification if it's not a manual sync
//         if (!isManualSync && flags.length > 0) {
//           toast.info("Team flags synchronized", { id: "flag-sync" });
//         }
//       }

//       // Update last sync time
//       lastSyncRef.current = Date.now();

//       // If this was a manual sync, show confirmation
//       if (isManualSync) {
//         toast.success("Team data synchronized successfully");
//         manualSyncRequestedRef.current = false;
//       }
//     } catch (error) {
//       console.error("Error syncing team data:", error);
//       if (isManualSync) {
//         toast.error("Failed to synchronize team data");
//       }
//     } finally {
//       isSyncingRef.current = false;
//     }
//   };

//   // Manual sync button handler
//   const handleManualSync = () => {
//     manualSyncRequestedRef.current = true;
//     checkForTeamUpdates(true);
//   };

//   // Function to deterministically shuffle questions
//   const shuffleQuestions = (
//     questions: Tables<"questions">[],
//     seedString: string
//   ) => {
//     // Create a simple hash from the seed string
//     let seed = seedString
//       .split("")
//       .reduce((acc, char) => acc + char.charCodeAt(0), 0);

//     // Fisher-Yates shuffle with deterministic random using the seed
//     const shuffled = [...questions];
//     const randomGenerator = () => {
//       seed = (seed * 9301 + 49297) % 233280;
//       return seed / 233280;
//     };

//     for (let i = shuffled.length - 1; i > 0; i--) {
//       const j = Math.floor(randomGenerator() * (i + 1));
//       [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//     }

//     return shuffled;
//   };

//   // Handle toggling question flags
//   const handleFlag = async () => {
//     if (!state.testSession || !state.teams) return;

//     const questionId = state.questions[state.currentQuestion].id;
//     const flagId = `${state.testSession.id}-${state.teams.id}-${questionId}`;

//     try {
//       const isFlagged = await testService.toggleFlag(flagId, state.teams.id);

//       // Update flags state optimistically
//       dispatch({ type: "TOGGLE_FLAG", payload: flagId });

//       // Force a refresh of team data to ensure consistency
//       setTimeout(() => checkForTeamUpdates(true), 500);

//       toast.success(isFlagged ? "Question flagged" : "Flag removed");
//     } catch (error) {
//       console.error("Error toggling flag:", error);
//       toast.error("Failed to toggle flag");
//     }
//   };

//   // Validate input for short answer questions
//   const validateInput = (value: string, pattern: string | RegExp) => {
//     if (!pattern) return true; // No pattern means all inputs are valid

//     const regex = new RegExp(pattern);
//     const isValid = regex.test(value);

//     if (!isValid) {
//       dispatch({
//         type: "SET_SHORT_ANSWER_ERROR",
//         payload: "Input doesn't match the required format",
//       });
//     } else {
//       dispatch({ type: "SET_SHORT_ANSWER_ERROR", payload: "" });
//     }

//     return isValid;
//   };

//   // Handle multiple choice answer selection
//   const handleAnswer = async (
//     questionId: number,
//     choice: Tables<"choices">
//   ) => {
//     if (!state.testSession || !state.teams) return;

//     try {
//       // Check if we're selecting the already selected choice (unselect)
//       const isUnselecting = state.answers[questionId] === choice.id;

//       if (isUnselecting) {
//         // Optimistic UI update
//         dispatch({ type: "CLEAR_ANSWER", payload: questionId });

//         // Delete from database
//         await testService.deleteAnswer(state.testSession.id, questionId);
//         toast.success("Answer cleared");
//       } else {
//         // Optimistic UI update
//         dispatch({
//           type: "SET_ANSWER",
//           payload: { questionId, value: choice.id },
//         });

//         // Save to database
//         await testService.saveAnswer(
//           state.testSession.id,
//           questionId,
//           state.teams.id,
//           choice.id,
//           choice.choice_text
//         );
//       }

//       // Force a refresh of team data to ensure consistency
//       setTimeout(() => checkForTeamUpdates(true), 500);
//     } catch (error) {
//       console.error("Error handling answer:", error);
//       toast.error("Failed to save answer");

//       // Revert optimistic update on error
//       const previousAnswer = state.answers[questionId];
//       if (previousAnswer) {
//         dispatch({
//           type: "SET_ANSWER",
//           payload: { questionId, value: previousAnswer },
//         });
//       } else {
//         dispatch({ type: "CLEAR_ANSWER", payload: questionId });
//       }
//     }
//   };

//   // Handle short answer input
//   const handleShortAnswer = async (questionId: number, answer: string) => {
//     if (!state.testSession || !state.teams) return;

//     try {
//       // Optimistic UI update
//       dispatch({
//         type: "SET_ANSWER",
//         payload: { questionId, value: answer },
//       });
//       dispatch({ type: "SET_SHORT_ANSWER_SAVED", payload: true });

//       // Save to database
//       await testService.saveAnswer(
//         state.testSession.id,
//         questionId,
//         state.teams.id,
//         undefined,
//         answer
//       );

//       // Force a refresh of team data to ensure consistency
//       setTimeout(() => checkForTeamUpdates(true), 500);

//       toast.success("Answer saved");
//     } catch (error) {
//       console.error("Error saving short answer:", error);
//       toast.error("Failed to save answer");
//       dispatch({ type: "SET_SHORT_ANSWER_SAVED", payload: false });
//     }
//   };

//   // Clear a short answer
//   const clearShortAnswer = async (questionId: number) => {
//     if (!state.testSession) return;

//     try {
//       // Optimistic UI update
//       dispatch({ type: "CLEAR_ANSWER", payload: questionId });
//       dispatch({ type: "SET_SHORT_ANSWER_SAVED", payload: false });

//       // Delete from database
//       await testService.deleteAnswer(state.testSession.id, questionId);

//       // Force a refresh of team data to ensure consistency
//       setTimeout(() => checkForTeamUpdates(true), 500);

//       toast.success("Answer cleared");
//     } catch (error) {
//       console.error("Error clearing answer:", error);
//       toast.error("Failed to clear answer");
//     }
//   };

//   // Handle changing the current question
//   const handleQuestionChange = async (index: number) => {
//     if (index < 0 || index >= state.questions.length) return;

//     dispatch({ type: "SET_LOADING", payload: true });

//     try {
//       await validateSession();

//       dispatch({ type: "SET_CURRENT_QUESTION", payload: index });

//       const currentQuestionId = state.questions[index].id;

//       // Fetch latest team answers if needed
//       if (
//         Object.keys(state.answers).length === 0 ||
//         Date.now() - lastSyncRef.current > 5000
//       ) {
//         await checkForTeamUpdates(true);
//       }

//       // Check if current question is already answered
//       if (state.answers[currentQuestionId]) {
//         dispatch({ type: "SET_SHORT_ANSWER_SAVED", payload: true });
//       }

//       const questionType = state.questions[index].question_type;

//       // Handle question content based on type
//       if (
//         questionType === "multiple-choices" ||
//         questionType === "multiple-answers"
//       ) {
//         // Fetch and shuffle choices
//         const choicesData =
//           await testService.fetchChoicesByQuestionId(currentQuestionId);
//         const shuffledChoices = shuffleChoices(
//           choicesData,
//           state.testSession?.id || ""
//         );

//         dispatch({ type: "SET_CHOICES", payload: shuffledChoices });

//         // Process MDX for choices
//         const choicesMDX = shuffledChoices.map(
//           (choice) => choice.choice_mdx || ""
//         );
//         dispatch({ type: "SET_CHOICES_MD", payload: choicesMDX });
//       } else {
//         dispatch({ type: "SET_CHOICES", payload: [] });
//       }

//       // Set question MDX
//       dispatch({
//         type: "SET_QUESTION_MD",
//         payload: state.questions[index].question_mdx || "",
//       });
//     } catch (error) {
//       console.error("Error changing question:", error);
//       toast.error("Failed to load question");
//     } finally {
//       dispatch({ type: "SET_LOADING", payload: false });
//     }
//   };

//   // Function to deterministically shuffle choices
//   const shuffleChoices = (choices: Tables<"choices">[], seedString: string) => {
//     let choiceSeed = seedString
//       .split("")
//       .reduce((acc, char) => acc + char.charCodeAt(0), 0);

//     const shuffled = [...choices];
//     const choiceRandomGenerator = () => {
//       choiceSeed = (choiceSeed * 9301 + 49297) % 233280;
//       return choiceSeed / 233280;
//     };

//     for (let i = shuffled.length - 1; i > 0; i--) {
//       const j = Math.floor(choiceRandomGenerator() * (i + 1));
//       [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//     }

//     return shuffled;
//   };

//   // Handle showing/hiding submit modal
//   const handleSubmitModal = () => {
//     dispatch({ type: "SET_SUBMIT_MODAL", payload: true });
//   };

//   const handleCloseModal = () => {
//     dispatch({ type: "SET_SUBMIT_MODAL", payload: false });
//   };

//   // Submit the test
//   const submitTest = async () => {
//     if (!state.testSession) return;

//     dispatch({ type: "SET_SUBMITTING", payload: true });

//     try {
//       await testService.submitTest(state.testSession.id, state.answers);

//       // We'll let the server handle score calculation
//       // await calculateScore(state.testSession.id, state.teams!.id, state.test!.id);

//       toast.success("Test submitted successfully");
//       router.push(`/cbt`);
//     } catch (error) {
//       console.error("Error submitting test:", error);
//       toast.error("Failed to submit test");
//       dispatch({ type: "SET_SUBMITTING", payload: false });
//     }
//   };

//   // Format remaining time
//   const formatTime = (seconds: number) => {
//     if (seconds <= 0) return "00:00:00";

//     const hour = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secondsLeft = seconds % 60;

//     return `${hour.toString().padStart(2, "0")} hours ${minutes
//       .toString()
//       .padStart(
//         2,
//         "0"
//       )} minutes ${secondsLeft.toString().padStart(2, "0")} seconds`;
//   };

//   if (!state.test || !state.questions.length || state.loading) {
//     return <QuestionSkeleton />;
//   }

//   return (
//     <div className="w-full py-8 bg-gradient-to-b from-secondary to-secondary/90 min-h-screen mx-auto">
//       {/* Main Quiz Container */}
//       <div className="w-full max-w-[80%] mx-auto rounded-xl overflow-hidden shadow-lg">
//         {/* Timer and Navigation Block */}
//         <div className="bg-gradient-to-r from-background to-background/95 p-5 rounded-t-xl border-b border-border/30">
//           <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
//             <div className="text-foreground font-semibold flex items-center gap-2">
//               <Clock className="h-5 w-5 text-primary" />
//               <span>Time Remaining: {formatTime(state.timeRemaining)}</span>
//             </div>
//             <div className="flex items-center gap-3">
//               <button
//                 onClick={handleManualSync}
//                 className="flex items-center gap-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded-md"
//                 title="Sync team data"
//               >
//                 <RefreshCw className="h-3 w-3" />
//                 <span>Sync</span>
//               </button>
//               <div className="text-foreground/80 bg-muted px-3 py-1 rounded-full text-sm font-medium">
//                 Question {state.currentQuestion + 1} of {state.questions.length}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Question Navigation */}
//         <div className="bg-background/95 p-5 border-b border-border/30">
//           <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
//             {state.questions.map((_, index) => (
//               <button
//                 key={index}
//                 className={`p-2 relative rounded-lg border ${
//                   index === state.currentQuestion
//                     ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md"
//                     : state.answers[state.questions[index].id]
//                       ? "bg-accent/20 text-foreground border-accent/40"
//                       : "bg-background border-border/50 text-foreground/80"
//                 } hover:bg-primary/50 hover:text-primary-foreground transition-all duration-200`}
//                 onClick={() => handleQuestionChange(index)}
//               >
//                 {isQuestionFlagged(state.questions[index].id) && (
//                   <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background"></div>
//                 )}
//                 {index + 1}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Question Content */}
//         <div className="bg-gradient-to-b from-background to-background/98 p-6 sm:p-8 rounded-b-xl shadow-inner">
//           <div className="flex justify-between items-center mb-6">
//             <h2 className="text-xl text-foreground font-semibold flex items-center gap-2">
//               <FileQuestion className="h-5 w-5 text-primary" />
//               Question {state.currentQuestion + 1}
//             </h2>
//             <button
//               className={`p-2 rounded-full transition-colors ${
//                 isQuestionFlagged(state.questions[state.currentQuestion].id)
//                   ? "bg-destructive/10 text-destructive"
//                   : "text-muted-foreground hover:bg-muted"
//               }`}
//               onClick={handleFlag}
//             >
//               {isQuestionFlagged(state.questions[state.currentQuestion].id) ? (
//                 <Flag className="h-5 w-5" />
//               ) : (
//                 <FlagOff className="h-5 w-5" />
//               )}
//             </button>
//           </div>

//           <div
//             className="max-w-none mb-8 markdown-body text-foreground bg-card/50 p-6 rounded-lg border border-border/30 shadow-sm"
//             data-theme={theme}
//             style={{ colorScheme: theme }}
//           >
//             {state.questionMD ? (
//               <MDXContent code={state.questionMD} />
//             ) : (
//               state.questions[state.currentQuestion].question_text
//             )}
//           </div>

//           {/* Team Activity Indicator */}
//           <div className="flex items-center justify-end mb-3 text-xs">
//             <span className="flex items-center gap-1 text-muted-foreground">
//               <Users className="h-3 w-3" />
//               <span>
//                 Last synced{" "}
//                 {((Date.now() - lastSyncRef.current) / 1000).toFixed(0)}s ago
//               </span>
//             </span>
//           </div>

//           {/* Answer Options */}
//           <div className="space-y-3 mt-6">
//             {state.questions[state.currentQuestion].question_type ===
//             "short-answer" ? (
//               <div className="bg-card/50 p-3 rounded-lg border border-border/30">
//                 <div className="flex flex-col gap-2">
//                   <div className="flex gap-2">
//                     <input
//                       type="text"
//                       value={
//                         state.answers[
//                           state.questions[state.currentQuestion].id
//                         ] || ""
//                       }
//                       onChange={(e) => {
//                         const value = e.target.value;
//                         if (
//                           value ===
//                           state.answers[
//                             state.questions[state.currentQuestion].id
//                           ]
//                         ) {
//                           dispatch({
//                             type: "SET_SHORT_ANSWER_SAVED",
//                             payload: true,
//                           });
//                         } else {
//                           dispatch({
//                             type: "SET_SHORT_ANSWER_SAVED",
//                             payload: false,
//                           });
//                         }

//                         // Validate input but don't save yet
//                         validateInput(
//                           value,
//                           state.questions[state.currentQuestion]
//                             .validation_pattern || ".*"
//                         );

//                         // Update local state without saving to database
//                         dispatch({
//                           type: "SET_ANSWER",
//                           payload: {
//                             questionId:
//                               state.questions[state.currentQuestion].id,
//                             value,
//                           },
//                         });
//                       }}
//                       className={`flex-1 w-full p-3 bg-background/80 border ${
//                         state.shortAnswerValidationError
//                           ? "border-red-500 focus:ring-red-500"
//                           : "border-input focus:ring-primary/50 focus:border-primary"
//                       } rounded-lg focus:ring-2 outline-none transition-all`}
//                       placeholder="Type your answer here..."
//                     />
//                     <button
//                       onClick={() => {
//                         const value =
//                           state.answers[
//                             state.questions[state.currentQuestion].id
//                           ] || "";
//                         if (
//                           validateInput(
//                             value,
//                             state.questions[state.currentQuestion]
//                               .validation_pattern || ".*"
//                           )
//                         ) {
//                           handleShortAnswer(
//                             state.questions[state.currentQuestion].id,
//                             value
//                           );
//                         }
//                       }}
//                       className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium ${
//                         state.shortAnswerSaved
//                           ? "bg-green-600 text-white hover:bg-green-700"
//                           : "bg-primary text-primary-foreground hover:bg-primary/50"
//                       }`}
//                       disabled={
//                         !state.answers[
//                           state.questions[state.currentQuestion].id
//                         ]
//                       }
//                     >
//                       {state.shortAnswerSaved ? "Saved" : "Save"}
//                       {state.shortAnswerSaved ? (
//                         <Check className="h-4 w-4 animate-pulse" />
//                       ) : (
//                         <Check className="h-4 w-4" />
//                       )}
//                     </button>

//                     {/* Clear Answer Button */}
//                     {state.answers[
//                       state.questions[state.currentQuestion].id
//                     ] && (
//                       <button
//                         onClick={() =>
//                           clearShortAnswer(
//                             state.questions[state.currentQuestion].id
//                           )
//                         }
//                         className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all flex items-center gap-2 font-medium"
//                         title="Clear answer"
//                       >
//                         <Trash2 className="h-4 w-4" />
//                       </button>
//                     )}
//                   </div>
//                   {state.shortAnswerValidationError && (
//                     <p className="text-red-500 text-sm mt-1">
//                       {state.shortAnswerValidationError}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             ) : (
//               <div className="bg-card/50 p-3 rounded-lg border border-border/30">
//                 {state.choices.map((choice, index) => (
//                   <label
//                     key={index}
//                     className={`flex items-center space-x-3 p-4 rounded-lg mb-2 last:mb-0 cursor-pointer transition-colors ${
//                       state.answers[
//                         state.questions[state.currentQuestion].id
//                       ] === choice.id
//                         ? "bg-primary/10 border border-primary/30"
//                         : "hover:bg-muted border border-transparent"
//                     }`}
//                   >
//                     <div
//                       className={`flex-shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center ${
//                         state.answers[
//                           state.questions[state.currentQuestion].id
//                         ] === choice.id
//                           ? "border-primary bg-primary/20"
//                           : "border-muted-foreground"
//                       }`}
//                     >
//                       {state.answers[
//                         state.questions[state.currentQuestion].id
//                       ] === choice.id && (
//                         <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
//                       )}
//                     </div>
//                     <input
//                       type="radio"
//                       name={`question-${state.questions[state.currentQuestion].id}`}
//                       value={choice.id}
//                       checked={
//                         state.answers[
//                           state.questions[state.currentQuestion].id
//                         ] === choice.id
//                       }
//                       onChange={() =>
//                         handleAnswer(
//                           state.questions[state.currentQuestion].id,
//                           choice
//                         )
//                       }
//                       className="sr-only"
//                     />
//                     <div className="markdown-body flex-grow">
//                       {state.choicesMD[index] ? (
//                         <MDXContent code={state.choicesMD[index]} />
//                       ) : (
//                         choice.choice_text
//                       )}
//                     </div>

//                     {/* Clear choice button (visible only when selected) */}
//                     {state.answers[
//                       state.questions[state.currentQuestion].id
//                     ] === choice.id && (
//                       <button
//                         onClick={() =>
//                           handleAnswer(
//                             state.questions[state.currentQuestion].id,
//                             choice
//                           )
//                         }
//                         className="ml-2 p-1 bg-destructive/10 text-destructive rounded-full hover:bg-destructive/20 transition-colors"
//                         title="Unselect answer"
//                       >
//                         <X className="h-4 w-4" />
//                       </button>
//                     )}
//                   </label>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* Navigation Buttons */}
//           <div className="mt-8 flex justify-between">
//             <button
//               onClick={() =>
//                 handleQuestionChange(Math.max(0, state.currentQuestion - 1))
//               }
//               disabled={state.currentQuestion === 0}
//               className="px-6 py-3 bg-background text-foreground rounded-lg border border-border flex items-center gap-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//             >
//               <ChevronLeft className="h-4 w-4" />
//               Previous
//             </button>

//             {state.currentQuestion === state.questions.length - 1 ? (
//               <button
//                 onClick={handleSubmitModal}
//                 className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg hover:opacity-90 transition-all flex items-center gap-2 font-medium shadow-md"
//               >
//                 Submit Test
//                 <Send className="h-4 w-4" />
//               </button>
//             ) : (
//               <button
//                 onClick={() =>
//                   handleQuestionChange(
//                     Math.min(
//                       state.questions.length - 1,
//                       state.currentQuestion + 1
//                     )
//                   )
//                 }
//                 className="px-6 py-3 bg-background text-foreground rounded-lg border border-border flex items-center gap-2 hover:bg-muted transition-colors"
//               >
//                 Next
//                 <ChevronRight className="h-4 w-4" />
//               </button>
//             )}
//           </div>

//           {/* Submit Modal */}
//           {state.showSubmitModal && (
//             <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
//               <div className="bg-background p-6 rounded-xl shadow-xl w-full max-w-2xl border border-border/50">
//                 <h3 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
//                   <AlertCircle className="h-5 w-5 text-primary" />
//                   Confirm Submission
//                 </h3>

//                 <div className="mb-6">
//                   <h4 className="font-medium mb-3 text-foreground/80">
//                     Test Summary
//                   </h4>
//                   <div className="grid grid-cols-2 gap-4">
//                     <div className="bg-gradient-to-br from-muted to-muted/80 p-4 rounded-lg shadow-sm border border-border/20">
//                       <p className="text-foreground/70 font-medium text-sm mb-1">
//                         Answered Questions
//                       </p>
//                       <p className="text-2xl font-bold text-foreground flex items-end gap-1">
//                         <span>{Object.keys(state.answers).length}</span>
//                         <span className="text-base text-foreground/60 font-normal">
//                           / {state.questions.length}
//                         </span>
//                       </p>
//                     </div>
//                     <div className="bg-gradient-to-br from-muted to-muted/80 p-4 rounded-lg shadow-sm border border-border/20">
//                       <p className="text-foreground/70 font-medium text-sm mb-1">
//                         Flagged Questions
//                       </p>
//                       <p className="text-2xl font-bold text-foreground flex items-center">
//                         {state.flags.length}
//                         {state.flags.length > 0 && (
//                           <Flag className="h-4 w-4 ml-1 text-destructive" />
//                         )}
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="mb-6">
//                   <h4 className="font-medium mb-3 text-foreground/80">
//                     Question Status
//                   </h4>
//                   <div className="max-h-60 overflow-y-auto p-2 border rounded-lg bg-card/50">
//                     {state.questions.map((question, index) => (
//                       <div
//                         key={index}
//                         className="flex items-center py-2 px-3 border-b last:border-b-0 hover:bg-muted/50 rounded-md transition-colors"
//                       >
//                         <span className="mr-3 bg-muted w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium">
//                           {index + 1}
//                         </span>
//                         {state.answers[question.id] ? (
//                           <span className="text-green-600 dark:text-green-400 font-medium flex items-center">
//                             <Check className="h-4 w-4 mr-1" /> Answered
//                           </span>
//                         ) : (
//                           <span className="text-red-500 font-medium flex items-center">
//                             <X className="h-4 w-4 mr-1" /> Not answered
//                           </span>
//                         )}
//                         {isQuestionFlagged(question.id) && (
//                           <span className="ml-auto text-destructive flex items-center">
//                             <Flag size={14} className="mr-1" /> Flagged
//                           </span>
//                         )}
//                       </div>
//                     ))}
//                   </div>
//                 </div>

//                 <div className="text-sm text-primary mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center">
//                   <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
//                   <span>
//                     Are you sure you want to submit? Once submitted, you cannot
//                     return to this test.
//                   </span>
//                 </div>

//                 <div className="flex justify-end space-x-4">
//                   <button
//                     onClick={handleCloseModal}
//                     className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-foreground"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     onClick={submitTest}
//                     disabled={state.submitting}
//                     className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-70 shadow-md flex items-center gap-2"
//                   >
//                     {state.submitting ? (
//                       <>
//                         <span className="animate-spin h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full mr-1"></span>
//                         Submitting...
//                       </>
//                     ) : (
//                       <>
//                         Submit Test
//                         <Send className="h-4 w-4" />
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
