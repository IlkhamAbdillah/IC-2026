"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter, useParams } from "next/navigation";
import { Tables } from "@/types/database.types";
import Link from "next/link";
import { useEffect, useState } from "react";
import MDXContent from "@/components/cbt/MDXContent";
import { Clock, CalendarClock, Lock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import PasswordInput from "@/components/PasswordInput";

export default function InstructionPage() {
  const router = useRouter();
  const { slug } = useParams();
  const [testData, setTestData] = useState<Tables<"tests"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compiledCode, setCompiledCode] = useState("");
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Password handling states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        const { data: sessionData, error: authError } =
          await supabase.auth.getSession();

        if (authError) throw new Error(authError.message);

        if (!sessionData.session?.user) {
          router.push("/sign-in");
          return;
        }

        // Fetch tests data
        const { data: tests, error: testsError } = await supabase
          .from("tests")
          .select("*")
          .eq("slug", slug)
          .single<Tables<"tests">>();

        if (testsError) throw new Error(testsError.message);

        setTestData(tests);

        // Check if test has a password
        // setShowPasswordModal(!!tests.password);

        const response = await fetch("/api/mdx", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: tests.instructions ?? "" }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to compile MDX: ${JSON.stringify(response.body)}`
          );
        }

        const { code } = await response.json();
        setCompiledCode(code);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [router, slug]);

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    setIsVerifying(true);
    setPasswordError(null);

    try {
      const response = await fetch("/api/verify-test-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || "Invalid password");
        return;
      }

      setIsPasswordVerified(true);
      setShowPasswordModal(false);
      router.push(`/cbt/${slug}/questions`);
    } catch (err) {
      setPasswordError("An error occurred during verification");
      console.error("Password verification error:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStartTest = () => {
    if (testData?.password && !isPasswordVerified) {
      setShowPasswordModal(true);
    } else {
      router.push(`/cbt/${slug}/questions`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/30 to-secondary/10">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/30 to-secondary/10">
        <div className="max-w-md p-6 bg-background rounded-lg shadow-lg border border-border/30">
          <p className="text-destructive flex items-center gap-2 font-medium">
            <span className="bg-destructive/10 p-2 rounded-full">
              <Lock className="h-5 w-5" />
            </span>
            Error: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 bg-gradient-to-b from-secondary/30 to-secondary/10 min-h-screen">
      <div className="w-full max-w-[80%] mx-auto px-4 sm:px-6">
        <div className="bg-background/95 rounded-xl overflow-hidden shadow-lg border border-border/30">
          <header className="p-6 border-b border-border/30 bg-gradient-to-r from-background to-background/95">
            <h2 className="font-bold text-2xl text-foreground">
              {testData?.title}
            </h2>
          </header>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Test Overview Card */}
            <div className="bg-custom p-6 rounded-lg border border-border/30 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-foreground">
                    Overview
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {testData?.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground">
                    <Clock className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-lg">Duration</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {testData?.duration} minutes
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground">
                    <CalendarClock className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-lg">Test Time</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Start:{" "}
                    {testData?.start_time
                      ? formatInTimeZone(
                          new Date(testData?.start_time),
                          userTimeZone,
                          "PPpp"
                        )
                      : "Not scheduled"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    End:{" "}
                    {testData?.end_time
                      ? formatInTimeZone(
                          new Date(testData?.end_time),
                          userTimeZone,
                          "PPpp"
                        )
                      : "Not scheduled"}
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={handleStartTest}
                    disabled={new Date() < new Date(testData?.start_time!)}
                    className={`inline-flex px-6 py-2.5 font-medium text-sm rounded-md transition-all shadow-sm ${
                      testData?.start_time &&
                      new Date() < new Date(testData.start_time)
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    {testData?.password && !isPasswordVerified && (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    {testData?.start_time &&
                    new Date() < new Date(testData.start_time)
                      ? "Not Yet Started"
                      : "Start Test"}
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions Content */}
            <div className="prose prose-gray max-w-none">
              <div className="bg-custom rounded-lg p-6 border border-border/30 shadow-sm markdown-body text-justify">
                <MDXContent code={compiledCode} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-xl shadow-xl max-w-md w-full border border-border/50">
            <h3 className="text-xl font-bold mb-4 flex items-center text-foreground">
              <Lock className="w-5 h-5 mr-2 text-primary" />
              Test Password Required
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This test is password protected. Please enter the password to
              continue.
            </p>

            <div className="space-y-4">
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Enter test password"
                error={passwordError ?? undefined}
              />

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyPassword}
                  disabled={isVerifying}
                  className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-md hover:opacity-90 transition-colors disabled:opacity-70 shadow-sm"
                >
                  {isVerifying ? (
                    <span className="flex items-center">
                      <span className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
                      Verifying...
                    </span>
                  ) : (
                    "Start"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
