"use server";
import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/types/database.types";

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

    // get the correction table
    const { data: correctionTable, error: correctionError } = await supabase
        .from("correction_table")
        .select("*")
        .returns<Tables<"correction_table">[]>();

    // get the answers of the test session
    const { data: answers, error } = await supabase
        .from("answers")
        .select("*")
        .eq("test_session_id", testSessionId)
        .returns<Tables<"answers">[]>();

    // get the questions of the test session
    const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", testId)
        .returns<Tables<"questions">[]>();

    // get the team 

    if (!answers) {
        return 0;
    }

    // for each answers, get the respective questions score if the answer is correct
    let score = 0;
    for (const answer of answers) {
        if (answer.choice_id === null && answer.answer_text === null) {
            score += 0;
            break;
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