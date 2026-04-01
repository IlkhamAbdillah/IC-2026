import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/types/database.types";

export async function getTestByTestId(testId: number): Promise<Tables<"tests">> {
  const supabase = await createClient();
  const { data: tests, error } = await supabase
    .from("tests")
    .select("*")
    .eq("id", testId)
    .single<Tables<"tests">>();

  if (error) {
      throw new Error(error.message);
  }

  return tests;
}

export async function getQuestionsByTestId(testId: number): Promise<Tables<"questions">[]> {
  const supabase = await createClient();
  const { data: questions, error } = await supabase
    .from("questions")
    .select("*")
    .eq("testid", testId)
    .returns<Tables<"questions">[]>();

  if (error) {
      throw new Error(error.message);
  }

  return questions;
}

export async function getChoicesByQuestionId(questionId: number): Promise<Tables<"choices">[]> {
  const supabase = await createClient();
  const { data: choices, error } = await supabase
    .from("choices")
    .select("*")
    .eq("questionid", questionId)
    .returns<Tables<"choices">[]>();

  if (error) {
      throw new Error(error.message);
  }

  return choices;
}