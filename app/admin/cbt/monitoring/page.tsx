"use client";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Tables } from "@/types/database.types";
import {
  SearchIcon,
  ArrowLeft,
  AlertCircle,
  BarChart2,
  Users,
  Flag,
  RefreshCw,
  Clock,
  Filter,
  Layers,
  Grid,
} from "lucide-react";

type UnfairnessReport = Tables<"unfairness"> & {
  test_title?: string;
  test_id?: number;
  team_name?: string;
  team_id?: number;
};

// Better structured GroupedData type to avoid index type conflicts
type GroupedData = {
  reports: Record<string, UnfairnessReport[]>;
  labels: Record<string, string>;
};

export default function CBTMonitoringPage() {
  const router = useRouter();
  const [unfairnessReports, setUnfairnessReports] = useState<
    UnfairnessReport[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTeamId, setFilterTeamId] = useState<number | null>(null);
  const [filterTestId, setFilterTestId] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "team" | "test">("none");
  const [categories, setCategories] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [tests, setTests] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    async function fetchUnfairnessReports() {
      setIsLoading(true);
      const supabase = await createClient();
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !session?.user) {
        router.push(
          "/sign-in?next=" + encodeURIComponent(window.location.pathname)
        );
        return;
      }

      // Get all unfairness reports with joined test_sessions and tests
      const { data, error: unfairnessError } = await supabase
        .from("unfairness")
        .select(
          `
          *,
          test_sessions (
            id,
            team_id,
            teams (
              id,
              name
            ),
            test_id,
            tests (
              id,
              title,
              slug
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (unfairnessError) {
        setError("Failed to load unfairness reports");
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError("No unfairness reports found");
        setIsLoading(false);
        return;
      }

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(
          data
            .map((report) => report.category)
            .filter((category): category is string => !!category)
        )
      );
      setCategories(uniqueCategories);

      // Transform data to include test title, id, team name, and team id
      const transformedData = data.map((report) => ({
        ...report,
        test_title: report.test_sessions?.tests?.title || "Unknown Test",
        test_id: report.test_sessions?.tests?.id,
        team_name: report.test_sessions?.teams?.name || "Unknown Team",
        team_id: report.test_sessions?.teams?.id,
      }));

      // Extract unique teams and tests for filters
      const uniqueTeams = Array.from(
        new Map(
          transformedData
            .filter((report) => report.team_id !== undefined)
            .map((report) => [
              report.team_id,
              { id: report.team_id!, name: report.team_name || "Unknown Team" },
            ])
        ).values()
      );

      const uniqueTests = Array.from(
        new Map(
          transformedData
            .filter((report) => report.test_id !== undefined)
            .map((report) => [
              report.test_id,
              {
                id: report.test_id!,
                title: report.test_title || "Unknown Test",
              },
            ])
        ).values()
      );

      setTeams(uniqueTeams);
      setTests(uniqueTests);
      setUnfairnessReports(transformedData);
      setIsLoading(false);
    }

    fetchUnfairnessReports();
  }, [router]);

  const handleRefresh = async () => {
    setIsLoading(true);
    const supabase = await createClient();
    const { data, error: unfairnessError } = await supabase
      .from("unfairness")
      .select(
        `
        *,
        test_sessions (
          id,
          team_id,
          teams (
            id,
            name
          ),
          test_id,
          tests (
            id,
            title,
            slug
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (unfairnessError) {
      setError("Failed to refresh unfairness reports");
      setIsLoading(false);
      return;
    }

    // Transform data to include test title, id, team name, and team id
    const transformedData = data.map((report) => ({
      ...report,
      test_title: report.test_sessions?.tests?.title || "Unknown Test",
      test_id: report.test_sessions?.tests?.id,
      team_name: report.test_sessions?.teams?.name || "Unknown Team",
      team_id: report.test_sessions?.teams?.id,
    }));

    // Extract unique teams and tests for filters
    const uniqueTeams = Array.from(
      new Map(
        transformedData
          .filter((report) => report.team_id !== undefined)
          .map((report) => [
            report.team_id,
            { id: report.team_id!, name: report.team_name || "Unknown Team" },
          ])
      ).values()
    );

    const uniqueTests = Array.from(
      new Map(
        transformedData
          .filter((report) => report.test_id !== undefined)
          .map((report) => [
            report.test_id,
            { id: report.test_id!, title: report.test_title || "Unknown Test" },
          ])
      ).values()
    );

    setTeams(uniqueTeams);
    setTests(uniqueTests);
    setUnfairnessReports(transformedData);
    setIsLoading(false);
  };

  // Apply all filters (search, category, team, test)
  const filteredReports = unfairnessReports.filter(
    (report) =>
      (report.test_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.team_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.detail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.category?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!filterCategory || report.category === filterCategory) &&
      (!filterTeamId || report.team_id === filterTeamId) &&
      (!filterTestId || report.test_id === filterTestId)
  );

  // Group reports by team or test if grouping is enabled
  const groupedReports = (): GroupedData => {
    const result: GroupedData = {
      reports: {},
      labels: {},
    };

    if (groupBy === "none") {
      result.reports.ungrouped = filteredReports;
      result.labels.ungrouped = "All Reports";
      return result;
    }

    filteredReports.forEach((report) => {
      let key;
      let displayLabel;

      if (groupBy === "team") {
        key = String(report.team_id || "unknown");
        displayLabel = report.team_name || "Unknown Team";
      } else {
        key = String(report.test_id || "unknown");
        displayLabel = report.test_title || "Unknown Test";
      }

      if (!result.reports[key]) {
        result.reports[key] = [];
        result.labels[key] = displayLabel;
      }

      result.reports[key].push(report);
    });

    return result;
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterCategory(null);
    setFilterTeamId(null);
    setFilterTestId(null);
    setGroupBy("none");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/20 to-background/95">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const groupedData = groupedReports();
  // Get group keys from the reports object
  const groups = Object.keys(groupedData.reports);

  return (
    <div className="w-full py-8 bg-gradient-to-b from-secondary/20 to-background/95 min-h-screen">
      <div className="w-full max-w-[80%] mx-auto px-4">
        <div className="flex flex-col gap-8">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Admin Dashboard
            </button>
            <h1 className="text-3xl font-bold tracking-tight">
              CBT Monitoring & Unfairness Reports
            </h1>
            <p className="text-muted-foreground">
              Monitor all unfairness reports and issues from test takers
            </p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden">
            {/* Search and filter */}
            <div className="p-6 border-b border-border/20">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center bg-accent/30 rounded-lg px-3 py-2 flex-1">
                    <SearchIcon className="h-5 w-5 text-muted-foreground mr-2" />
                    <input
                      type="text"
                      placeholder="Search reports..."
                      className="bg-transparent border-none outline-none w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="bg-accent/30 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-muted/80 transition-colors"
                  >
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>

                {/* Advanced filtering and grouping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Group By selector */}
                  <div className="relative">
                    <label className="text-sm text-muted-foreground block mb-1">
                      Group By
                    </label>
                    <div className="relative">
                      <select
                        className="bg-accent/30 rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer border border-border/20 w-full"
                        value={groupBy}
                        onChange={(e) =>
                          setGroupBy(e.target.value as "none" | "team" | "test")
                        }
                      >
                        <option value="none" className="bg-background">No Grouping</option>
                        <option value="team" className="bg-background">Group by Team</option>
                        <option value="test" className="bg-background">Group by Test</option>
                      </select>
                      <Layers className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Category filter */}
                  <div className="relative">
                    <label className="text-sm text-muted-foreground block mb-1">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        className="bg-accent/30 rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer border border-border/20 w-full"
                        value={filterCategory || ""}
                        onChange={(e) =>
                          setFilterCategory(
                            e.target.value === "" ? null : e.target.value
                          )
                        }
                      >
                        <option value="" className="bg-background">All Categories</option>
                        {categories.map((category) => (
                          <option key={category} value={category} className="bg-background">
                            {category}
                          </option>
                        ))}
                      </select>
                      <Filter className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Team filter */}
                  <div className="relative">
                    <label className="text-sm text-muted-foreground block mb-1">
                      Team
                    </label>
                    <div className="relative">
                      <select
                        className="bg-accent/30 rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer border border-border/20 w-full"
                        value={filterTeamId || ""}
                        onChange={(e) =>
                          setFilterTeamId(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                      >
                        <option value="" className="bg-background">All Teams</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id} className="bg-background">
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <Users className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Test filter */}
                  <div className="relative">
                    <label className="text-sm text-muted-foreground block mb-1">
                      Test
                    </label>
                    <div className="relative">
                      <select
                        className="bg-accent/30 rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer border border-border/20 w-full"
                        value={filterTestId || ""}
                        onChange={(e) =>
                          setFilterTestId(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                      >
                        <option value="" className="bg-background">All Tests</option>
                        {tests.map((test) => (
                          <option key={test.id} value={test.id} className="bg-background">
                            {test.title}
                          </option>
                        ))}
                      </select>
                      <BarChart2 className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Active filters */}
                {(searchQuery ||
                  filterCategory ||
                  filterTeamId ||
                  filterTestId ||
                  groupBy !== "none") && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {searchQuery && (
                      <div className="bg-primary/10 text-primary text-xs rounded-full px-3 py-1 flex items-center">
                        <span>Search: {searchQuery}</span>
                        <button
                          className="ml-2 hover:text-primary/70"
                          onClick={() => setSearchQuery("")}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {filterCategory && (
                      <div className="bg-primary/10 text-primary text-xs rounded-full px-3 py-1 flex items-center">
                        <span>Category: {filterCategory}</span>
                        <button
                          className="ml-2 hover:text-primary/70"
                          onClick={() => setFilterCategory(null)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {filterTeamId && (
                      <div className="bg-primary/10 text-primary text-xs rounded-full px-3 py-1 flex items-center">
                        <span>
                          Team: {teams.find((t) => t.id === filterTeamId)?.name}
                        </span>
                        <button
                          className="ml-2 hover:text-primary/70"
                          onClick={() => setFilterTeamId(null)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {filterTestId && (
                      <div className="bg-primary/10 text-primary text-xs rounded-full px-3 py-1 flex items-center">
                        <span>
                          Test:{" "}
                          {tests.find((t) => t.id === filterTestId)?.title}
                        </span>
                        <button
                          className="ml-2 hover:text-primary/70"
                          onClick={() => setFilterTestId(null)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {groupBy !== "none" && (
                      <div className="bg-primary/10 text-primary text-xs rounded-full px-3 py-1 flex items-center">
                        <span>
                          Grouped by: {groupBy === "team" ? "Team" : "Test"}
                        </span>
                        <button
                          className="ml-2 hover:text-primary/70"
                          onClick={() => setGroupBy("none")}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-muted-foreground underline hover:text-foreground ml-1"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Reports list */}
            {filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-accent/30 rounded-xl border border-border/30 shadow-sm m-6">
                <Flag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">No Reports Found</h3>
                <p className="text-muted-foreground max-w-md">
                  No unfairness reports found matching your search criteria.
                </p>
              </div>
            ) : (
              <div className="p-6">
                {groupBy === "none" ? (
                  // Ungrouped view
                  <div className="grid gap-6">
                    {filteredReports.map((report) => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                ) : (
                  // Grouped view
                  <div className="space-y-8">
                    {groups.map((groupKey) => (
                      <div
                        key={groupKey}
                        className="border border-border/30 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-4 bg-muted/50 p-3 rounded-lg">
                          <h2 className="text-lg font-semibold flex items-center">
                            {groupBy === "team" ? (
                              <Users className="h-5 w-5 mr-2 text-primary" />
                            ) : (
                              <BarChart2 className="h-5 w-5 mr-2 text-primary" />
                            )}
                            {groupedData.labels[groupKey]}
                          </h2>
                          <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                            {groupedData.reports[groupKey].length} reports
                          </span>
                        </div>
                        <div className="grid gap-4">
                          {groupedData.reports[groupKey].map((report) => (
                            <ReportCard key={report.id} report={report} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl shadow-md border border-border/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Flag className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">Total Reports</h3>
              </div>
              <p className="text-3xl font-bold">{unfairnessReports.length}</p>
              <p className="text-sm text-muted-foreground mt-2">
                All time unfairness reports
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-md border border-border/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">Categories</h3>
              </div>
              <p className="text-3xl font-bold">{categories.length}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Unique issue categories reported
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-md border border-border/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">Recent Reports</h3>
              </div>
              <p className="text-3xl font-bold">
                {
                  unfairnessReports.filter(
                    (report) =>
                      new Date(report.created_at) >
                      new Date(Date.now() - 24 * 60 * 60 * 1000)
                  ).length
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                New reports in the last 24 hours
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate component for report cards to improve readability
function ReportCard({ report }: { report: UnfairnessReport }) {
  return (
    <div className="w-full bg-card rounded-xl shadow-md border border-border/30 overflow-hidden transition-all hover:shadow-lg">
      <div className="p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold">
              {report.category || "Unspecified Issue"}
            </h2>
          </div>
          <span className="text-sm text-muted-foreground">ID: {report.id}</span>
        </div>
        <p className="text-muted-foreground text-sm">
          From Test:{" "}
          <span className="font-medium text-foreground">
            {report.test_title}
          </span>
          {" • Team: "}
          <span className="font-medium text-foreground">
            {report.team_name || "Unknown"}
          </span>
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Report Details
            </h3>
            <p className="text-sm bg-muted/30 p-3 rounded-md">
              {report.detail || "No details provided"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                Session ID
              </h3>
              <p className="text-sm font-mono bg-muted/30 p-2 rounded-md truncate">
                {report.test_session_id || "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                User ID
              </h3>
              <p className="text-sm font-mono bg-muted/30 p-2 rounded-md truncate">
                {report.user_id || "Anonymous"}
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                Reported At
              </h3>
              <p className="text-sm bg-muted/30 p-2 rounded-md">
                {new Date(report.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
