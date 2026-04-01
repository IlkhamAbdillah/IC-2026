"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Tables } from "@/types/database.types";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { Clock, Calendar, Info } from "lucide-react";

export default function CbtPage() {
  const router = useRouter();
  const supabase = createClient();
  const [testsData, setTestsData] = useState<Tables<"tests">[] | null>(null);
  const [finishedTests, setFinishedTests] = useState<Tables<"finishes">[]>([]);
  const [teams, setTeams] = useState<Tables<"teams">>();
  const [teamSessions, setTeamSessions] = useState<Tables<"test_sessions">[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          return router.push("/sign-in");
        }

        const role = user?.user_metadata?.role;
        setIsAdmin(role === "Admin");

        // Query tests berdasarkan role
        let testsQuery = supabase.from("tests").select("*");
        if (role !== "Admin") {
          testsQuery = testsQuery.eq("ispublic", true);
        }

        // Jalankan query tests dan members secara paralel
        const [testsResult, teamsResult] = await Promise.all([
          testsQuery.returns<Tables<"tests">[]>(),
          supabase.from("members").select("teams(*)").eq("email", user.email).single(),
        ]);

        if (testsResult.error) {
          console.error(testsResult.error);
          setLoading(false);
          return;
        }

        setTestsData(testsResult.data);
        const team = teamsResult.data?.teams as unknown as Tables<"teams">;
        setTeams(team);

        // Jika user punya team, ambil data sesi dan riwayat selesai secara paralel
        if (team) {
          const [sessionsResult, finishesResult] = await Promise.all([
            supabase.from("test_sessions").select("*").eq("team_id", team.id),
            supabase.from("finishes").select("*").filter("session_id", "ilike", `${team.id}-%`),
          ]);

          setTeamSessions((sessionsResult.data as Tables<"test_sessions">[]) || []);
          setFinishedTests((finishesResult.data as Tables<"finishes">[]) || []);
        }

      } catch (error) {
        console.error("Critical error fetching CBT data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase, router]);

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
          
          {/* Header Page Section */}
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Available Tests</h1>
              <p className="text-muted-foreground">Select a test below to begin your assessment</p>
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
            {/* Empty State */}
            {testsData?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-xl border border-border/30 shadow-sm">
                <Info className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2 text-foreground">No Available Tests</h3>
                <p className="text-muted-foreground max-w-md">There are currently no available tests for you.</p>
              </div>
            )}

            {/* Test Cards Mapping */}
            {testsData?.map((test) => {
              // Sembunyikan jika waktu berakhir sudah lewat (Client-side safety)
              if (test.end_time && new Date() > new Date(test.end_time)) {
                return null;
              }

              // Hitung Status Sesi dan Riwayat Selesai
              const session = teamSessions.find((s) => s.test_id === test.id);
              const finishRecord = finishedTests.find((f) => f.session_id?.includes(`${test.id}`));
              const isCompleted = session?.status === "finished" || !!finishRecord;

              // Tentukan Text Status dan Warna Badge Status
              let statusText = "Not Started";
              let statusColor = "bg-blue-600/50 text-white-500 border border-blue-500/20"; // Warna default biru/Not Started

              if (session) {
                if (session.status === "ongoing") {
                  statusText = "In Progress";
                  statusColor = "bg-amber-500/50 text-white-500 border border-amber-500/20";
                } else if (session.status === "finished") {
                  statusText = "Submitted";
                  statusColor = "bg-emerald-500/30 text-white-500 border border-emerald-500/20";
                } else {
                  statusText = `Status: ${session.status}`;
                }
              }

              // Tentukan Status Visibility (Hanya Admin yang butuh melihat ini secara eksplisit)
              const isPublic = (test as any).ispublic ?? false;

              return (
                <div key={test.id} className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden transition-all hover:shadow-lg">
                  
                  {/* --- Header Card Section (SESUAI GAMBAR) --- */}
                  <div className="p-6 border-b border-border/20 space-y-3">
                    <h2 className="text-2xl font-semibold text-foreground tracking-tight">{test.title}</h2>
                    
                    <div className="flex flex-wrap gap-2.5">
                      {/* Badge Status Sesi */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                        {statusText}
                      </span>
                      
                      {/* Badge Visibility (Hanya untuk Admin) */}
                      {isAdmin && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isPublic ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                          {isPublic ? "Public" : "Private"}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* ------------------------------------------- */}

                  {/* Body Card Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Info size={16} className="text-primary" />
                        <span className="text-sm font-medium">Description</span>
                      </div>
                      <p className="text-sm text-foreground/90">{test.description || "No description available"}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock size={16} className="text-primary" />
                        <span className="text-sm font-medium">Duration</span>
                      </div>
                      <p className="text-sm text-foreground/90">{test.duration} minutes</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar size={16} className="text-primary" />
                        <span className="text-sm font-medium">Schedule</span>
                      </div>
                      <div className="space-y-1 text-sm text-foreground/90">
                        <p><span className="text-muted-foreground">Start:</span> {test.start_time ? formatInTimeZone(new Date(test.start_time), userTimeZone, "PPpp") : "Not scheduled"}</p>
                        <p><span className="text-muted-foreground">End:</span> {test.end_time ? formatInTimeZone(new Date(test.end_time), userTimeZone, "PPpp") : "Not scheduled"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Card Section (Info & Tombol Aksi) */}
                  <div className="p-6 bg-muted/30 border-t border-border/20 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      Created: {test.created_at ? formatInTimeZone(new Date(test.created_at), userTimeZone, "PPp") : "-"}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        // State: Selesai
                        <div className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 dark:text-emerald-100 dark:bg-emerald-800/30 rounded-md shadow-sm">
                          Completed {finishRecord?.created_at ? formatInTimeZone(new Date(finishRecord.created_at), userTimeZone, "PPp") : ""}
                        </div>
                      ) : (
                        // State: Belum Selesai (Bisa Mulai/Lanjut)
                        <Link
                          href={`/cbt/${test.slug}/instructions`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 rounded-md shadow-sm transition-all"
                        >
                          {session?.status === "ongoing" ? "Continue" : "Start Test"}
                        </Link>
                      )}
                    </div>
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