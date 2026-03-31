"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Tables } from "@/types/database.types";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { Clock, Calendar, Info } from "lucide-react";
import { set } from "date-fns";

export default function CbtPage() {
  const router = useRouter();
  const supabase = createClient();
  const [testsData, setTestsData] = useState<Tables<"tests">[] | null>(null);
  const [finishedTests, setFinishedTests] = useState<Tables<"finishes">[]>([]);
  const [teams, setTeams] = useState<Tables<"teams">>();
  const [teamSessions, setTeamSessions] = useState<Tables<"test_sessions">[]>(
    []
  );
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const role = user?.user_metadata?.role;
        setIsAdmin(role === "Admin");
      }
    }

    checkAdmin();
  }, [supabase]);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return router.push("/sign-in");
      }

      const role = user?.user_metadata?.role;
      const admin = role === "Admin";
      setIsAdmin(admin);

      let testsQuery = supabase.from("tests").select("*");
      if (!admin) {
        testsQuery = testsQuery.eq("ispublic", true);
      }

      const { data: testsData, error: testsError } = await testsQuery.returns<
        Tables<"tests">[]
      >();

      if (testsError) {
        console.error(testsError);
        return;
      }

      setTestsData(testsData);

      const { data: teams } = await supabase
        .from("members")
        .select("teams(*)")
        .eq("email", user.email)
        .single();

      const team = teams?.teams as unknown as Tables<"teams">;
      setTeams(team);

      const { data: teamSessions } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("team_id", team.id);

      setTeamSessions(teamSessions as Tables<"test_sessions">[]);

      const { data: finishedTests } = await supabase
        .from("finishes")
        .select("*")
        .filter("session_id", "ilike", `${team.id}-%`);

      setFinishedTests(finishedTests as Tables<"finishes">[]);
    }

    fetchData();
  }, []);

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set loading to false after data is fetched
    if (testsData) {
      setLoading(false);
    }
  }, [testsData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/20 to-background/95">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 bg-gradient-to-b from-secondary/20 to-background/95 min-h-screen">
      <div className="w-full max-w-[80%] mx-auto px-4">
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Available Tests
              </h1>
              <p className="text-muted-foreground">
                Select a test below to begin your assessment
              </p>
            </div>
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all h-10"
              >
                Go to Admin Page
              </Link>
            )}
          </div>

          <div className="grid gap-6">
            {testsData?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-accent/30 rounded-xl border border-border/30 shadow-sm">
                <Info className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">No Available Tests</h3>
                <p className="text-muted-foreground max-w-md">
                  There are currently no available tests. Please check back
                  later or contact your administrator.
                </p>
              </div>
            )}

            {testsData?.map((test) => {
              // Skip tests where current time is past the end time
              if (test.end_time && new Date() > new Date(test.end_time)) {
                return null;
              }

              const isCompleted = finishedTests.some((finish) => {
                const parts = finish.session_id?.split("-");
                return parts && parts.length > 1 && parts[1] === `${test.id}`;
              });

              return (
                <div
                  key={test.id}
                  className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden transition-all hover:shadow-lg"
                >
                  <div className="p-6 border-b border-border/20">
                    <h2 className="text-xl font-semibold mb-2">{test.title}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Info size={16} className="text-primary" />
                        <span className="text-sm font-medium">Description</span>
                      </div>
                      <p className="text-sm">
                        {test.description || "No description available"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock size={16} className="text-primary" />
                        <span className="text-sm font-medium">Duration</span>
                      </div>
                      <p className="text-sm">{test.duration} minutes</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar size={16} className="text-primary" />
                        <span className="text-sm font-medium">Schedule</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm flex items-center gap-1">
                          <span className="text-muted-foreground">Start:</span>
                          <span>
                            {test.start_time
                              ? formatInTimeZone(
                                  new Date(test.start_time),
                                  userTimeZone,
                                  "PPpp"
                                )
                              : "Not scheduled"}
                          </span>
                        </p>
                        <p className="text-sm flex items-center gap-1">
                          <span className="text-muted-foreground">End:</span>
                          <span>
                            {test.end_time
                              ? formatInTimeZone(
                                  new Date(test.end_time),
                                  userTimeZone,
                                  "PPpp"
                                )
                              : "Not scheduled"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-muted/30 border-t border-border/20 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Created:{" "}
                      {test.created_at
                        ? formatInTimeZone(
                            new Date(test.created_at),
                            userTimeZone,
                            "PPp"
                          )
                        : "Date not available"}
                    </div>
                    {isCompleted ? (
                      <div className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-green-700 bg-green-100 dark:text-green-100 dark:bg-green-800/30 rounded-md shadow-sm">
                        Completed{" "}
                        {formatInTimeZone(
                          new Date(
                            finishedTests.find((finish) =>
                              finish.session_id!.includes(`${test.id}`)
                            )?.created_at || ""
                          ),
                          userTimeZone,
                          "PPp"
                        )}
                      </div>
                    ) : (
                      <Link
                        href={`/cbt/${test.slug}/instructions`}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
                      >
                        Start Test
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
