"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tables } from "@/types/database.types";

export default function CreateTest() {
  const supabase = createClient();
  const [testData, setTestData] = useState<Tables<"tests">>({
    id: 0,
    title: "",
    slug: "",
    description: null,
    duration: 60,
    instructions: null,
    password: null,
    start_time: null,
    end_time: null,
    created_at: null,
  });

  const [questions, setQuestions] = useState<Tables<"questions">[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Tables<"questions">>({
    id: 0,
    test_id: 0,
    question_text: "",
    question_mdx: null,
    question_type: "multiple-choices",
    points: 1,
    has_choices: true,
    next_question_id: null,
    minus: 1,
    validation_pattern: null,
  });

  const [currentQuestionChoices, setCurrentQuestionChoices] = useState<
    Tables<"choices">[]
  >([]);

  const [correctionTable, setCorrectionTable] =
    useState<Tables<"correction_table">>();

  const [availableTests, setAvailableTests] = useState<Tables<"tests">[]>([]);

  useEffect(() => {
    const fetchAvailableTests = async () => {
      try {
        const { data, error } = await supabase
          .from("tests")
          .select()
          .returns<Tables<"tests">[]>();

        if (error) throw error;

        setAvailableTests(data);
      } catch (error) {
        console.error("Error fetching available tests:", error);
        alert("Error fetching available tests");
      }
    };

    fetchAvailableTests();
  }, []);

  useEffect(() => {
    if (testData.start_time && testData.duration) {
      const startTime = new Date(testData.start_time);
      const endTime = new Date(startTime.getTime() + testData.duration * 60000);
      setTestData({ ...testData, end_time: endTime.toISOString() });
    }
  }, [testData.start_time, testData.duration]);

  useEffect(() => {}, [questions]);

  const handleFetchTestData = async (testId: number) => {
    try {
      const { data, error } = await supabase
        .from("tests")
        .select()
        .eq("id", testId)
        .single();

      if (error) throw error;

      setTestData(data);

      const { data: questions, error: questionError } = await supabase
        .from("questions")
        .select()
        .eq("test_id", testId);

      if (questionError) throw questionError;

      setQuestions(questions);
      setCurrentQuestion(questions[0]);

      const { data: choices, error: choiceError } = await supabase
        .from("choices")
        .select()
        .in(
          "question_id",
          questions.map((q) => q.id)
        );

      if (choiceError) throw choiceError;

      setCurrentQuestionChoices(
        choices.filter((c) => c.question_id === questions[0].id)
      );

      const { data: correction, error: correctionError } = await supabase
        .from("correction_table")
        .select()
        .eq("question_id", questions[0].id)
        .single();

      if (correctionError) throw correctionError;

      setCorrectionTable(correction);
    } catch (error) {
      console.error("Error fetching test data:", error);
      alert("Error fetching test data");
    }
  };

  const handleTestDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setTestData({ ...testData, [e.target.name]: e.target.value });
  };

  const handleQuestionChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setCurrentQuestion({ ...currentQuestion, [e.target.name]: e.target.value });
  };

  const handleChoiceChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newChoices = [...currentQuestionChoices];
    newChoices[index] = {
      ...newChoices[index],
      choice_text: e.target.value,
    };
    setCurrentQuestionChoices(newChoices);
  };

  const handleCorrectChoiceChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (correctionTable) {
      setCorrectionTable({
        ...correctionTable,
        choice_id: currentQuestionChoices[index].id,
      });
    }
  };

  const handleShortAnswerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (correctionTable) {
      setCorrectionTable({ ...correctionTable, answer_text: e.target.value });
    }
  };

  const addChoice = async (index: number) => {
    const { data: newData } = await supabase
      .from("choices")
      .insert([
        {
          question_id: currentQuestion.id,
          choice_text: "",
          choice_mdx: null,
        },
      ])
      .select()
      .single<Tables<"choices">>();

    setCurrentQuestionChoices([
      ...currentQuestionChoices,
      {
        id: newData!.id,
        question_id: currentQuestion.id,
        choice_text: "",
        choice_mdx: null,
      },
    ]);

    if (currentQuestionChoices[index - 1]) {
      const response = await fetch("/api/mdx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: currentQuestionChoices[index - 1].choice_text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to compile MDX: ${response.statusText}`);
      }

      const { code } = await response.json();
      const { error } = await supabase
        .from("choices")
        .update({
          choice_text: currentQuestionChoices[index - 1].choice_text,
          choice_mdx: code,
        })
        .eq("id", currentQuestionChoices[index - 1].id);

      if (error) throw error;
      alert("Choice added successfully!");
    }
  };

  const removeChoice = async (index: number) => {
    const newChoices = currentQuestionChoices.filter((_, i) => i !== index);
    setCurrentQuestionChoices(newChoices);

    const { error } = await supabase
      .from("choices")
      .delete()
      .eq("id", currentQuestionChoices[index].id);

    if (error) throw error;
    alert("Choice removed successfully!");
  };

  const saveQuestion = async () => {
    const response = await fetch("/api/mdx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: currentQuestion.question_text }),
    });

    if (!response.ok) {
      throw new Error(`Failed to compile MDX: ${response.statusText}`);
    }

    const { code } = await response.json();

    currentQuestion.question_mdx = code;

    if (currentQuestion.id) {
      const { error } = await supabase
        .from("questions")
        .update(currentQuestion)
        .eq("id", currentQuestion.id);

      if (error) throw error;

      const { error: correctionError } = await supabase
        .from("correction_table")
        .update(correctionTable!)
        .eq("question_id", currentQuestion.id);

      if (correctionError) throw correctionError;
      alert("Question and answer updated successfully!");
    } else {
      const { error } = await supabase
        .from("questions")
        .insert([currentQuestion])
        .select()
        .single<Tables<"questions">>();

      if (error) throw error;

      if (currentQuestion.question_type === "multiple-choices") {
        const { error: correctionError } = await supabase
          .from("correction_table")
          .insert([
            {
              question_id: currentQuestion.id,
              choice_id: correctionTable?.choice_id,
            },
          ]);

        if (correctionError) throw correctionError;
        alert("Correction table created successfully!");
      } else if (currentQuestion.question_type === "short-answer") {
        const { error: correctionError } = await supabase
          .from("correction_table")
          .insert([
            {
              question_id: currentQuestion.id,
              answer_text: correctionTable?.answer_text,
            },
          ]);

        if (correctionError) throw correctionError;
        alert("Correction table created successfully!");
      }

      const { data: newQuestion, error: newQuestionError } = await supabase
        .from("questions")
        .select()
        .eq("test_id", testData.id)
        .returns<Tables<"questions">[]>();

      if (newQuestionError) throw newQuestionError;
      setQuestions(newQuestion);

      alert("Question created (saved) successfully!");
    }
  };

  const addQuestion = async () => {
    // if (!questions.some((q) => q.id === currentQuestion.id)) {
    //   setQuestions([...questions, currentQuestion]);
    // }

    const response = await fetch("/api/mdx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: currentQuestion.question_text }),
    });

    if (!response.ok) {
      throw new Error(`Failed to compile MDX: ${response.statusText}`);
    }

    const { code } = await response.json();

    currentQuestion.question_mdx = code;

    if (currentQuestion.id) {
      const { error } = await supabase
        .from("questions")
        .update(currentQuestion)
        .eq("id", currentQuestion.id);

      if (error) throw error;

      const { error: correctionError } = await supabase
        .from("correction_table")
        .update(correctionTable!)
        .eq("question_id", currentQuestion.id);

      if (correctionError) throw correctionError;
      alert("Question and answer updated successfully!");
    } else {
      const { error } = await supabase
        .from("questions")
        .insert([currentQuestion])
        .select()
        .single<Tables<"questions">>();

      if (error) throw error;

      if (currentQuestion.question_type === "multiple-choices") {
        const { error: correctionError } = await supabase
          .from("correction_table")
          .upsert([
            {
              id: correctionTable?.id,
              question_id: currentQuestion.id,
              choice_id: correctionTable?.choice_id,
            },
          ]);

        if (correctionError) throw correctionError;
        alert("Correction table created successfully!");
      } else if (currentQuestion.question_type === "short-answer") {
        const { error: correctionError } = await supabase
          .from("correction_table")
          .upsert([
            {
              id: correctionTable?.id,
              question_id: currentQuestion.id,
              answer_text: correctionTable?.answer_text,
            },
          ]);

        if (correctionError) throw correctionError;
        alert("Correction table created successfully!");
      }

      const { data: newQuestion, error: newQuestionError } = await supabase
        .from("questions")
        .select()
        .eq("test_id", testData.id)
        .returns<Tables<"questions">[]>();

      if (newQuestionError) throw newQuestionError;
      setQuestions(newQuestion);

      alert("Question created successfully!");
    }

    const newQuestion = {
      test_id: testData.id,
      question_text: "",
      question_mdx: null,
      question_type: "multiple-choices",
      points: 1,
      has_choices: true,
      next_question_id: null,
    };

    const { data } = await supabase
      .from("questions")
      .insert(newQuestion)
      .select()
      .single<Tables<"questions">>();

    setCurrentQuestion(data!);

    setCurrentQuestionChoices([]);

    const { data: newCorrection, error: newCorrectionError } = await supabase
      .from("correction_table")
      .insert({
        answer_text: null,
        choice_id: null,
        question_id: data!.id,
        question_score: null,
        score: null,
      })
      .select()
      .single<Tables<"correction_table">>();

    if (newCorrectionError) throw newCorrectionError;
    setCorrectionTable(newCorrection);
  };

  const removeQuestion = (id: number) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleSaveTestInfo = async () => {
    try {
      if (testData.id) {
        const { error } = await supabase
          .from("tests")
          .update(testData)
          .eq("id", testData.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tests")
          .insert([testData])
          .select()
          .single();

        if (error) throw error;

        setTestData(data);
      }
    } catch (error) {
      console.error("Error saving test info:", error);
      alert("Error saving test info");
    }
  };

  const editSelectedQuestion = async (id: number) => {
    const question = questions.find((q) => q.id === id);
    if (question) {
      setCurrentQuestion(question);

      const { data: choices, error: choiceError } = await supabase
        .from("choices")
        .select()
        .eq("question_id", question.id);

      if (choiceError) throw choiceError;

      setCurrentQuestionChoices(choices);

      const { data: correction, error: correctionError } = await supabase
        .from("correction_table")
        .select()
        .eq("question_id", question.id)
        .single();

      if (correctionError) throw correctionError;

      setCorrectionTable(correction);
    }
  };

  const handleSave = async () => {
    try {
      // Insert test
      const { data: test, error: testError } = await supabase
        .from("tests")
        .insert([testData])
        .select()
        .single();

      if (testError) throw testError;

      // Insert questions
      const questionsWithTestId = questions.map((q) => ({
        ...q,
        test_id: test.id,
      }));
      const { data: savedQuestions, error: questionError } = await supabase
        .from("questions")
        .insert(questionsWithTestId)
        .select();

      if (questionError) throw questionError;

      // Insert choices for each question
      for (let i = 0; i < savedQuestions.length; i++) {
        if (questions[i].has_choices) {
          const choicesWithQuestionId = currentQuestionChoices.map((c) => ({
            ...c,
            question_id: savedQuestions[i].id,
          }));

          const { error: choiceError } = await supabase
            .from("choices")
            .insert(choicesWithQuestionId);

          if (choiceError) throw choiceError;
        }
      }

      alert("Test created successfully!");
    } catch (error) {
      console.error("Error saving test:", error);
      alert("Error creating test");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/20 to-background/95 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[80%] mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Manage Test</h1>

        <div className="bg-card shadow-sm rounded-xl overflow-hidden mb-8 p-6 border border-border/30">
          <h2 className="text-xl font-semibold mb-4">Test Information</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-muted-foreground">
                Select available tests (optional)
              </Label>
              <select
                id="available_tests"
                name="available_tests"
                onChange={(e) => handleFetchTestData(Number(e.target.value))}
                className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value="">Select a test</option>
                {availableTests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-muted-foreground">
                Test Title
              </Label>
              <Input
                id="title"
                name="title"
                value={testData.title}
                onChange={handleTestDataChange}
                placeholder="Enter test title"
                className="bg-background text-foreground border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-muted-foreground">
                Description
              </Label>
              <textarea
                id="description"
                name="description"
                value={testData.description || ""}
                onChange={handleTestDataChange}
                placeholder="Enter test description"
                className="w-full h-32 p-4 border border-border rounded-lg font-mono bg-background text-foreground"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-muted-foreground">
                  Duration (minutes)
                </Label>
                <Input
                  id="duration"
                  name="duration"
                  type="number"
                  value={testData.duration || ""}
                  onChange={handleTestDataChange}
                  className="bg-background text-foreground border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_time" className="text-muted-foreground">
                  Start Time
                </Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="datetime-local"
                  value={testData.start_time || ""}
                  onChange={handleTestDataChange}
                  className="bg-background text-foreground border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions" className="text-muted-foreground">
                  Instructions
                </Label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={testData.instructions || ""}
                  onChange={handleTestDataChange}
                  placeholder="Enter test instructions"
                  className="w-full h-32 p-4 border border-border rounded-lg font-mono bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-muted-foreground">
                  End Time
                </Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  disabled
                  value={testData.end_time || ""}
                  onChange={handleTestDataChange}
                  className="bg-muted text-muted-foreground border-border"
                />
              </div>
            </div>

            <Button
              variant="default"
              onClick={handleSaveTestInfo}
              className="w-full bg-primary hover:bg-primary/50 text-primary-foreground"
            >
              Save Test Information
            </Button>
          </div>
        </div>

        <div className="bg-card shadow-sm rounded-xl overflow-hidden mb-8 p-6 border border-border/30">
          <h2 className="text-xl font-semibold mb-4">Add Questions</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="question_text" className="text-muted-foreground">
                Question Text
              </Label>
              <textarea
                id="question_text"
                name="question_text"
                value={currentQuestion.question_text}
                onChange={handleQuestionChange}
                placeholder="Enter question"
                className="w-full h-32 p-4 border border-border rounded-lg font-mono bg-background text-foreground"
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label
                  htmlFor="question_type"
                  className="text-muted-foreground"
                >
                  Question Type
                </Label>
                <select
                  id="question_type"
                  name="question_type"
                  value={currentQuestion.question_type}
                  onChange={handleQuestionChange}
                  className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="multiple-choices">Multiple Choice</option>
                  <option value="short-answer">Short Answer</option>
                </select>
              </div>

              <div className="space-y-2 flex-1">
                <Label htmlFor="points" className="text-muted-foreground">
                  Points
                </Label>
                <Input
                  id="points"
                  name="points"
                  type="number"
                  value={currentQuestion.points || ""}
                  onChange={handleQuestionChange}
                  className="bg-background text-foreground border-border"
                />
              </div>
            </div>

            {currentQuestion.question_type === "multiple-choices" && (
              <div className="space-y-4 border border-border rounded-lg p-4">
                <h3 className="text-md font-medium">Answer Choices</h3>
                {currentQuestionChoices.map((choice, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 min-w-[24px]">
                      <input
                        type="radio"
                        name="correct_answer"
                        checked={correctionTable?.choice_id === choice.id}
                        onChange={(e) => handleCorrectChoiceChange(index, e)}
                        className="w-4 h-4 text-primary border-border"
                      />
                    </div>
                    <Input
                      name="choice_text"
                      value={choice.choice_text}
                      onChange={(e) => handleChoiceChange(index, e)}
                      placeholder={`Choice ${index + 1}`}
                      className="flex-1 bg-background text-foreground border-border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeChoice(index)}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => addChoice(currentQuestionChoices.length)}
                  className="w-full border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Add Choice
                </Button>
              </div>
            )}

            {currentQuestion.question_type === "short-answer" && (
              <div className="space-y-2 border border-border rounded-lg p-4">
                <Label htmlFor="answer" className="text-muted-foreground">
                  Answer
                </Label>
                <Input
                  id="answer"
                  name="answer"
                  value={correctionTable?.answer_text || ""}
                  onChange={handleShortAnswerChange}
                  placeholder="Enter answer"
                  className="bg-background text-foreground border-border"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={saveQuestion}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Save Question
              </Button>
              <Button
                onClick={addQuestion}
                className="flex-1 bg-primary hover:bg-primary/50 text-primary-foreground"
              >
                Save and Add Another Question
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-card shadow-sm rounded-xl overflow-hidden p-6 border border-border/30">
          <h3 className="text-lg font-semibold mb-4">Added Questions</h3>
          {questions.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No questions added yet. Start creating questions above.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 mb-2 sm:mb-0">
                    <h4 className="font-medium line-clamp-2">
                      {question.question_text.length > 80
                        ? `${question.question_text.substring(0, 80)}...`
                        : question.question_text}
                    </h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {question.question_type}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {question.points}{" "}
                        {question.points === 1 ? "point" : "points"}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        ID: {question.id}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editSelectedQuestion(question.id)}
                      className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
