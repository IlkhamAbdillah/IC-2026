"use server";
import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/types/database.types";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Stateless client for cached operations that cannot access cookies
const getStatelessSupabase = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function checkTestSession(teamId: number, testId: number): Promise<Tables<"test_sessions"> | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("team_id", teamId)
        .eq("test_id", testId)
        .single<Tables<"test_sessions">>();

    if (!data || error) {
        return null;
    }
    
    return data;
}

export async function createTestSession(teamId: string, testId: number): Promise<Tables<"test_sessions">> {
    const supabase = await createClient();
    const { data: existingSession, error: existingError } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("team_id", teamId)
        .eq("test_id", testId)
        .eq("status", "finished")
        .single<Tables<"test_sessions">>();

    if (existingSession) {
        return existingSession;
    }

    const { data, error } = await supabase
        .from("test_sessions")
        .upsert(
            { 
                id: `${teamId}-${testId}`,
                team_id: teamId, 
                test_id: testId, 
                status: "ongoing",
            },
            { 
                onConflict: 'id', // Specify the unique constraint
                ignoreDuplicates: false // Update existing record if found
            }
        )
        .select()
        .single<Tables<"test_sessions">>();

    if (error) {
        throw new Error(error.message);
    }

    // console.log(data);

  return data;
}

export async function calculateScore(testSessionId: string, teamId: string, testId: number): Promise<number> {
    const supabase = await createClient();

    // get the questions of the test session first (needed to filter correction_table)
    const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", testId)
        .returns<Tables<"questions">[]>();

    if (!questions || questions.length === 0) {
        return 0;
    }

    const questionIds = questions.map(q => q.id);

    // get the correction table filtered by question IDs of this test only
    const { data: correctionTable, error: correctionError } = await supabase
        .from("correction_table")
        .select("*")
        .in("question_id", questionIds)
        .returns<Tables<"correction_table">[]>();

    // get the answers of the test session
    const { data: answers, error } = await supabase
        .from("answers")
        .select("*")
        .eq("test_session_id", testSessionId)
        .returns<Tables<"answers">[]>();

    if (!answers) {
        return 0;
    }

    // for each answers, get the respective questions score if the answer is correct
    let score = 0;
    for (const answer of answers) {
        if (answer.choice_id === null && answer.answer_text === null) {
            continue;
        }

        const question = questions!.find(q => q.id === answer.question_id);
        let correctAnswer;
        if (question?.question_type === "multiple-choices") {
            correctAnswer = correctionTable!.find(correction => correction.choice_id === answer.choice_id);
        } else if (question?.question_type === "short-answer") {
            correctAnswer = correctionTable!.find(correction => correction.answer_text === answer.answer_text);
        }
        if (correctAnswer) {
            score += question!.points!;
        }
        else{
            score -= question!.minus!;
        }
    }

    await supabase
        .from("scores")
        .upsert(
            {
                id: `${teamId}-${testId}-${testSessionId}`,
                team_id: teamId,
                test_id: testId,
                session_id: testSessionId,
                score,
            },
            {
                onConflict: 'id',
                ignoreDuplicates: false
            }
        );
    return score;
}

// CACHED SERVER ACTIONS
// These functions use unstable_cache to deduplicate standard repetitive backend reads.

const _getCachedTestBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = getStatelessSupabase();
    const { data } = await supabase
      .from("tests")
      .select("*")
      .eq("slug", slug)
      .single<Tables<"tests">>();
    return data;
  },
  ["cbt-test-by-slug"],
  { revalidate: 60, tags: ["tests"] }
);

export async function getCachedTestBySlug(slug: string) {
  return _getCachedTestBySlug(slug);
}

const _getCachedTestById = unstable_cache(
  async (id: number) => {
    const supabase = getStatelessSupabase();
    const { data } = await supabase
      .from("tests")
      .select("*")
      .eq("id", id)
      .single<Tables<"tests">>();
    return data;
  },
  ["cbt-test-by-id"],
  { revalidate: 60, tags: ["tests"] }
);

export async function getCachedTestById(id: number) {
  return _getCachedTestById(id);
}

const _getCachedQuestions = unstable_cache(
  async (testId: number) => {
    const supabase = getStatelessSupabase();
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("id", { ascending: true })
      .returns<Tables<"questions">[]>();
    return data || [];
  },
  ["cbt-questions-by-test-id"],
  { revalidate: 60, tags: ["questions"] }
);

export async function getCachedQuestions(testId: number) {
  return _getCachedQuestions(testId);
}

const _getCachedChoices = unstable_cache(
  async (questionId: number) => {
    const supabase = getStatelessSupabase();
    const { data } = await supabase
      .from("choices")
      .select("*")
      .eq("question_id", questionId)
      .returns<Tables<"choices">[]>();
    return data || [];
  },
  ["cbt-choices-by-question-id"],
  { revalidate: 60, tags: ["choices"] }
);

export async function getCachedChoices(questionId: number) {
  return _getCachedChoices(questionId);
}