import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/database.types";
import { Input } from "@/components/ui/input";
import { Search, Eye, Printer } from "lucide-react";
import MDXContent from "@/components/cbt/MDXContent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuestionsReviewProps {
  questions: Tables<"questions">[];
  isLoading: boolean;
  onEditQuestion: (id: number) => void;
  onRemoveQuestion: (id: number) => void;
  onFinish: () => void;
}

export default function QuestionsReview({
  questions,
  isLoading,
  onEditQuestion,
  onRemoveQuestion,
  onFinish,
}: QuestionsReviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [previewQuestion, setPreviewQuestion] =
    useState<Tables<"questions"> | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const filteredQuestions = questions.filter((question) =>
    question.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePreviewQuestion = (question: Tables<"questions">) => {
    setPreviewQuestion(question);
    setIsPreviewOpen(true);
  };

  const handleSaveToPdf = async () => {
    // You might need to install a PDF library like jspdf and html2canvas
    try {
      // This is a placeholder - actual implementation depends on your PDF library
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");

      const doc = new jsPDF("p", "mm", "a4");
      let yOffset = 20;

      // Add title
      doc.setFontSize(16);
      doc.text("Questions Review", 20, yOffset);
      yOffset += 10;

      // Loop through each question
      questions.forEach((question, index) => {
        doc.setFontSize(12);
        doc.text(`${index + 1}. ${question.question_text}`, 20, yOffset);
        yOffset += 8;

        doc.setFontSize(10);
        doc.text(
          `Type: ${question.question_type} | Points: ${question.points}`,
          25,
          yOffset
        );
        yOffset += 15;

        // Add page if needed
        if (yOffset > 270) {
          doc.addPage();
          yOffset = 20;
        }
      });

      // Save the PDF
      doc.save("questions-review.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please check console for details.");
    }
  };

  return (
    <div className="bg-card shadow-sm rounded-xl overflow-hidden p-6 border border-border/30">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Review Questions</h3>
        <div className="flex gap-2">
          {/* <Button
            onClick={handleSaveToPdf}
            disabled={questions.length === 0 || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="mr-2 h-4 w-4" />
            Save to PDF
          </Button> */}
          <Button
            onClick={onFinish}
            disabled={questions.length === 0 || isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Finish
          </Button>
        </div>
      </div>

      <div className="mb-4 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No questions added yet. Go back to add questions.
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No questions match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((question) => (
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
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500">
                    {question.question_type}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {question.points}{" "}
                    {question.points === 1 ? "point" : "points"}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreviewQuestion(question)}
                  disabled={isLoading}
                  className="border-border text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditQuestion(question.id)}
                  disabled={isLoading}
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
                  onClick={() => onRemoveQuestion(question.id)}
                  disabled={isLoading}
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

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {previewQuestion && (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {previewQuestion.question_type}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {previewQuestion.points}{" "}
                    {previewQuestion.points === 1 ? "point" : "points"}
                  </span>
                </div>
                <div className="p-6 border markdown-body border-border/50 rounded-lg bg-custom shadow-sm">
                  {previewQuestion.question_mdx ? (
                    <MDXContent code={previewQuestion.question_mdx} />
                  ) : (
                    <p className="text-muted-foreground italic">
                      No content available for preview
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
