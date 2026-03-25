import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormErrors } from "@/types";
import { Tables } from "@/types/database.types";
import { validateTestData } from "@/utils/validation";

interface TestInfoFormProps {
  testData: Tables<"tests">;
  availableTests: Tables<"tests">[];
  errors: FormErrors;
  isLoading: boolean;
  isSubmitting: boolean;
  onSelectTest: (testId: number) => void;
  onUpdateTestData: (data: Partial<Tables<"tests">>) => void;
  onSave: () => void;
}

export default function TestInfoForm({
  testData,
  availableTests,
  errors,
  isLoading,
  isSubmitting,
  onSelectTest,
  onUpdateTestData,
  onSave,
}: TestInfoFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateTestData(testData);
    if (Object.keys(validationErrors).length > 0) {
      // Handle validation errors (you would dispatch these to your reducer)
      console.error("Validation errors:", validationErrors);
      return;
    }

    onSave();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onUpdateTestData({ [e.target.name]: e.target.value });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card shadow-sm rounded-xl overflow-hidden mb-8 p-6 border border-border/30"
    >
      <h2 className="text-xl font-semibold mb-4">Test Information</h2>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="available_tests" className="text-muted-foreground">
            Select available tests (optional)
          </Label>
          <select
            id="available_tests"
            name="available_tests"
            onChange={(e) => onSelectTest(Number(e.target.value))}
            disabled={isLoading}
            className="w-full p-2 border border-border rounded-lg bg-accent/30 text-foreground"
          >
            <option value="" className="bg-background">Select a test</option>
            {availableTests.map((test) => (
              <option key={test.id} value={test.id} className="bg-background">
                {test.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title" className="text-muted-foreground">
            Test Title*
          </Label>
          <Input
            id="title"
            name="title"
            value={testData.title}
            onChange={handleChange}
            placeholder="Enter test title"
            className={`bg-accent/30 text-foreground border-border ${
              errors.title ? "border-red-500" : ""
            }`}
          />
          {errors.title && (
            <p className="text-sm text-red-500 mt-1">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-muted-foreground">
            Description
          </Label>
          <textarea
            id="description"
            name="description"
            value={testData.description || ""}
            onChange={handleChange}
            placeholder="Enter test description"
            className="w-full h-32 p-4 border border-border rounded-lg font-mono bg-accent/30 text-foreground"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-muted-foreground">
              Duration (minutes)*
            </Label>
            <Input
              id="duration"
              name="duration"
              type="number"
              value={testData.duration || ""}
              onChange={handleChange}
              className={`bg-accent/30 text-foreground border-border ${
                errors.duration ? "border-red-500" : ""
              }`}
            />
            {errors.duration && (
              <p className="text-sm text-red-500 mt-1">{errors.duration}</p>
            )}
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
              onChange={handleChange}
              className="bg-accent/30 text-foreground border-border"
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
              onChange={handleChange}
              placeholder="Enter test instructions"
              className="w-full h-32 p-4 border border-border rounded-lg font-mono bg-accent/30 text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_time" className="text-muted-foreground">
              End Time (calculated)
            </Label>
            <Input
              id="end_time"
              name="end_time"
              type="datetime-local"
              disabled
              value={testData.end_time || ""}
              className="bg-muted text-muted-foreground border-border"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary hover:bg-primary/50 text-primary-foreground"
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
            "Continue to Questions"
          )}
        </Button>
      </div>
    </form>
  );
}
