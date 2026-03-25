import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tables } from "@/types/database.types";
import { FormErrors, TestAction } from "@/types";
import { toast } from "sonner";
import { apiService } from "@/services/api";
import {
  validateQuestion,
  validateChoices,
  validateShortAnswer,
} from "@/utils/validation";

interface QuestionFormProps {
  testId: number;
  currentQuestion: Tables<"questions">;
  choices: Tables<"choices">[];
  correctionTable?: Tables<"correction_table">;
  errors: FormErrors;
  isLoading: boolean;
  isSubmitting: boolean;
  dispatch: React.Dispatch<TestAction>;
  onNext: () => void;
}

export default function QuestionForm({
  testId,
  currentQuestion,
  choices,
  correctionTable,
  errors,
  isLoading,
  isSubmitting,
  dispatch,
  onNext,
}: QuestionFormProps) {
  // Track which choice is being saved
  const [savingChoiceId, setSavingChoiceId] = useState<number | null>(null);

  const handleQuestionChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    dispatch({
      type: "SET_CURRENT_QUESTION",
      payload: { ...currentQuestion, [e.target.name]: e.target.value },
    });
  };

  const handleChoiceChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newChoices = [...choices];
    newChoices[index] = {
      ...newChoices[index],
      choice_text: e.target.value,
    };
    dispatch({ type: "SET_QUESTION_CHOICES", payload: newChoices });
  };

  const handleCorrectChoiceChange = (index: number) => {
    if (correctionTable) {
      dispatch({
        type: "SET_CORRECTION_TABLE",
        payload: {
          ...correctionTable,
          choice_id: choices[index].id,
        },
      });
    }
  };

  const handleShortAnswerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (correctionTable) {
      dispatch({
        type: "SET_CORRECTION_TABLE",
        payload: {
          ...correctionTable,
          answer_text: e.target.value,
        },
      });
    }
  };

  // New function to save an individual choice
  const saveChoice = async (index: number) => {
    try {
      const choice = choices[index];
      setSavingChoiceId(choice.id);

      // Process MDX for the choice
      const mdxCode = await apiService.processMdx(choice.choice_text);

      // Save the choice with MDX
      await apiService.saveChoices([
        {
          ...choice,
          choice_mdx: mdxCode,
        },
      ]);

      toast.success(`Choice ${index + 1} saved successfully`);
    } catch (error) {
      toast.error(`Failed to save choice ${index + 1}`);
      console.error(error);
    } finally {
      setSavingChoiceId(null);
    }
  };

  const addChoice = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      // Create a new empty choice
      const newChoice: Partial<Tables<"choices">> = {
        question_id: currentQuestion.id,
        choice_text: "",
        choice_mdx: null,
      };

      const savedChoices = await apiService.saveChoices([newChoice]);

      dispatch({
        type: "SET_QUESTION_CHOICES",
        payload: [...choices, savedChoices[0]],
      });

      toast.success("New choice added");
    } catch (error) {
      toast.error("Failed to add choice");
      console.error(error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const removeChoice = async (index: number) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const choiceToRemove = choices[index];
      await apiService.deleteChoice(choiceToRemove.id);

      const newChoices = choices.filter((_, i) => i !== index);
      dispatch({ type: "SET_QUESTION_CHOICES", payload: newChoices });

      // If we're removing the correct answer, update correction table
      if (correctionTable?.choice_id === choiceToRemove.id) {
        dispatch({
          type: "SET_CORRECTION_TABLE",
          payload: {
            ...correctionTable,
            choice_id: null,
          },
        });
      }

      toast.success("Choice removed");
    } catch (error) {
      toast.error("Failed to remove choice");
      console.error(error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const saveQuestion = async () => {
    try {
      // Validate the question
      let validationErrors = validateQuestion(currentQuestion);

      if (currentQuestion.question_type === "multiple-choices") {
        const choiceErrors = validateChoices(choices, correctionTable);
        validationErrors = { ...validationErrors, ...choiceErrors };
      } else if (currentQuestion.question_type === "short-answer") {
        const shortAnswerErrors = validateShortAnswer(correctionTable);
        validationErrors = { ...validationErrors, ...shortAnswerErrors };
      }

      if (Object.keys(validationErrors).length > 0) {
        dispatch({ type: "SET_ERROR", payload: validationErrors });
        return;
      }

      dispatch({ type: "SET_SUBMITTING", payload: true });

      // Process MDX for question
      const mdxCode = await apiService.processMdx(
        currentQuestion.question_text
      );

      // Ensure we have the correct test_id
      const questionToSave = {
        ...currentQuestion,
        question_mdx: mdxCode,
        test_id: testId,
      };

      // Save question
      const savedQuestion = await apiService.saveQuestion(questionToSave);

      // Save choices if it's a multiple choice question
      if (savedQuestion.question_type === "multiple-choices") {
        const choicesToSave = choices.map((choice) => ({
          ...choice,
          question_id: savedQuestion.id,
        }));

        await apiService.saveChoices(choicesToSave);
      }

      // Save correction table
      if (correctionTable) {
        await apiService.saveCorrectionTable({
          ...correctionTable,
          question_id: savedQuestion.id,
        });
      }

      // Update state
      dispatch({ type: "SET_CURRENT_QUESTION", payload: savedQuestion });

      // Update questions list
      const updatedQuestions = await apiService.fetchQuestionsByTestId(testId);
      dispatch({ type: "UPDATE_QUESTIONS", payload: updatedQuestions });

      toast.success("Question saved successfully");
    } catch (error) {
      toast.error("Failed to save question");
      console.error(error);
    } finally {
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  };

  const saveAndAddAnother = async () => {
    await saveQuestion();

    // Reset for a new question
    dispatch({ type: "RESET_CURRENT_QUESTION" });

    // Create a new correction table entry
    try {
      const newQuestion: Partial<Tables<"questions">> = {
        test_id: testId,
        question_text: "",
        question_type: "multiple-choices",
        points: 1,
        has_choices: true,
      };

      const savedQuestion = await apiService.saveQuestion(newQuestion);

      const newCorrection: Partial<Tables<"correction_table">> = {
        question_id: savedQuestion.id,
        answer_text: null,
        choice_id: null,
      };

      const savedCorrection =
        await apiService.saveCorrectionTable(newCorrection);

      dispatch({ type: "SET_CURRENT_QUESTION", payload: savedQuestion });
      dispatch({ type: "SET_CORRECTION_TABLE", payload: savedCorrection });

      toast.success("New question created");
    } catch (error) {
      toast.error("Failed to create new question");
      console.error(error);
    }
  };

  return (
    <div className="bg-card shadow-sm rounded-xl overflow-hidden mb-8 p-6 border border-border/30">
      <h2 className="text-xl font-semibold mb-4">Add Questions</h2>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="question_text" className="text-muted-foreground">
            Question Text*
          </Label>
          <textarea
            id="question_text"
            name="question_text"
            value={currentQuestion.question_text}
            onChange={handleQuestionChange}
            placeholder="Enter question"
            className={`w-full h-32 p-4 border rounded-lg font-mono bg-accent/30 text-foreground ${
              errors.question_text ? "border-red-500" : "border-border"
            }`}
          />
          {errors.question_text && (
            <p className="text-sm text-red-500 mt-1">{errors.question_text}</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="space-y-2 flex-1">
            <Label htmlFor="question_type" className="text-muted-foreground">
              Question Type
            </Label>
            <select
              id="question_type"
              name="question_type"
              value={currentQuestion.question_type}
              onChange={handleQuestionChange}
              className="w-full p-2 border border-border rounded-lg bg-accent/30 text-foreground"
            >
              <option value="multiple-choices" className="bg-background">Multiple Choice</option>
              <option value="short-answer" className="bg-background">Short Answer</option>
            </select>
          </div>

          <div className="space-y-2 flex-1">
            <Label htmlFor="points" className="text-muted-foreground">
              Points*
            </Label>
            <Input
              id="points"
              name="points"
              type="number"
              value={currentQuestion.points || ""}
              onChange={handleQuestionChange}
              className={`bg-accent/30 text-foreground ${
                errors.points ? "border-red-500" : "border-border"
              }`}
            />
            {errors.points && (
              <p className="text-sm text-red-500 mt-1">{errors.points}</p>
            )}
          </div>
        </div>

        {currentQuestion.question_type === "multiple-choices" && (
          <div
            className={`space-y-4 border rounded-lg p-4 ${
              errors.choices || errors.choice_text || errors.correct_answer
                ? "border-red-500"
                : "border-border"
            }`}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium">Answer Choices*</h3>
              {(errors.choices ||
                errors.choice_text ||
                errors.correct_answer) && (
                <p className="text-sm text-red-500">
                  {errors.choices ||
                    errors.choice_text ||
                    errors.correct_answer}
                </p>
              )}
            </div>

            {choices.map((choice, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 min-w-[24px]">
                  <input
                    type="radio"
                    name="correct_answer"
                    checked={correctionTable?.choice_id === choice.id}
                    onChange={() => handleCorrectChoiceChange(index)}
                    className="w-4 h-4 text-primary border-border"
                  />
                </div>
                <Input
                  name="choice_text"
                  value={choice.choice_text}
                  onChange={(e) => handleChoiceChange(index, e)}
                  placeholder={`Choice ${index + 1}`}
                  className="flex-1 bg-accent/30 text-foreground border-border"
                />
                <div className="flex space-x-2">
                  {/* New Save button for individual choice */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveChoice(index)}
                    disabled={savingChoiceId === choice.id}
                    className="border-green-500 text-green-500 hover:bg-green-50 hover:text-green-700"
                  >
                    {savingChoiceId === choice.id ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-1 h-3 w-3 text-green-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Saving
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Save
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeChoice(index)}
                    disabled={isLoading || savingChoiceId === choice.id}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addChoice}
              disabled={isLoading}
              className="w-full border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Add Choice
            </Button>
          </div>
        )}

        {currentQuestion.question_type === "short-answer" && (
          <div className="space-y-2 border border-border rounded-lg p-4">
            <Label htmlFor="answer" className="text-muted-foreground">
              Answer*
            </Label>
            <Input
              id="answer"
              name="answer"
              value={correctionTable?.answer_text || ""}
              onChange={handleShortAnswerChange}
              placeholder="Enter answer"
              className={`bg-accent/30 text-foreground ${
                errors.answer_text ? "border-red-500" : "border-border"
              }`}
            />
            {errors.answer_text && (
              <p className="text-sm text-red-500 mt-1">{errors.answer_text}</p>
            )}

            <div className="space-y-2 mt-4">
              <Label
                htmlFor="validation_pattern"
                className="text-muted-foreground"
              >
                Validation Pattern (Regex)
              </Label>
              <Input
                id="validation_pattern"
                name="validation_pattern"
                value={currentQuestion.validation_pattern || ""}
                onChange={handleQuestionChange}
                placeholder="Enter regex pattern for validation (optional)"
                className="bg-accent/30 text-foreground border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Example: ^[0-9]+$ for numbers only, ^[a-zA-Z]+$ for letters only
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            type="button"
            onClick={saveQuestion}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Question"
            )}
          </Button>
          <Button
            type="button"
            onClick={saveAndAddAnother}
            disabled={isSubmitting}
            className="flex-1 bg-primary hover:bg-primary/50 text-white font-medium transition-colors"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </>
            ) : (
              "Save and Add Another Question"
            )}
          </Button>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            type="button"
            onClick={onNext}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Review Questions →
          </Button>
        </div>
      </div>
    </div>
  );
}
