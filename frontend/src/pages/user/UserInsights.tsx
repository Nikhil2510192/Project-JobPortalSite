import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { JobCard } from "@/components/JobCard";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type StrengthOrImprovement = string;

type AppliedJob = {
  id: number;
  title: string;
  company: string;
  location: string;
  salary?: string;
  type: string;
  posted?: string;
};

const UserInsights = () => {
  // --- State ---
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [strengths, setStrengths] = useState<StrengthOrImprovement[]>([]);
  const [improvements, setImprovements] = useState<StrengthOrImprovement[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Helper: Defensive Array Mapping ---
  const renderListItems = (data: any, dotColor: string) => {
    const safeArray = Array.isArray(data) 
      ? data 
      : (typeof data === "string" && data.trim() !== "" ? [data] : []);

    if (safeArray.length === 0) {
      return <li className="text-sm text-muted-foreground">No data available</li>;
    }

    return safeArray.map((item, index) => (
      <li key={index} className="flex items-start gap-3">
        <span className={`mt-2 flex h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <span className="text-sm text-foreground">{item}</span>
      </li>
    ));
  };

  // --- Effect 1: Fetch the Resume ID first ---
  useEffect(() => {
    const fetchMyResume = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/resume/my`, { 
          credentials: "include" 
        });
        
        if (!res.ok) {
           throw new Error("Could not find an active resume. Please upload one.");
        }

        const data = await res.json();
        if (data.resumeId) {
          setResumeId(data.resumeId);
        } else {
          throw new Error("Resume ID not found in response.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to identify user resume.");
        setLoading(false);
      }
    };

    fetchMyResume();
  }, []);

  // --- Effect 2: Fetch Insights once Resume ID is known ---
  useEffect(() => {
    if (!resumeId) return;

    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const resumeRes = await fetch(
          `${API_BASE_URL}/resume/analyze/${resumeId}`,
          { credentials: "include" }
        );
        const resumeData = await resumeRes.json();

        if (!resumeRes.ok) {
          throw new Error(resumeData.message || "Failed to load resume insights");
        }

        setResumeScore(resumeData.resumeScore ?? 0);
        setStrengths(resumeData.good ?? []);
        setImprovements(resumeData.improve ?? []);

        const jobsRes = await fetch(`${API_BASE_URL}/user/applied-jobs`, {
          credentials: "include",
        });

        const jobsData = await jobsRes.json();

        if (!jobsRes.ok) {
          throw new Error(jobsData.message || "Failed to load applied jobs");
        }

        const mappedJobs: AppliedJob[] = (jobsData.jobs || []).map(
          (job: any) => ({
            id: job.jobId,
            title: job.role,
            company: job.company?.name || "Unknown company",
            location: "Not specified",
            salary: job.salary ? `₹${job.salary}` : undefined,
            type: "Full-time",
            posted: job.deadline
              ? `Deadline: ${new Date(job.deadline).toLocaleDateString()}`
              : undefined,
          })
        );

        setAppliedJobs(mappedJobs);
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [resumeId]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading insights...</div>;
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center space-y-4">
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md border border-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground">AI Resume Insights</h1>
        <p className="text-muted-foreground mt-2">Powered by AI to help you stand out</p>
      </div>

      {/* Resume Score Card */}
      <div className="rounded-xl border border-border p-8 shadow-sm">
        <div className="flex items-center gap-6 mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground">
            <span className="text-3xl font-bold text-primary-foreground">
              {resumeScore ?? 0}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Resume Score</h2>
            <p className="text-muted-foreground">
              {resumeScore && resumeScore > 7 ? "Your resume is performing exceptionally well" : "Review the areas below to improve your score"}
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Match Progress</span>
            <span className="font-medium text-foreground">
              {resumeScore ?? 0}/10
            </span>
          </div>
          {/* The Progress bar colors up to the resumeScore value */}
          <Progress value={resumeScore ?? 0} className="h-2" />
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Check className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-foreground">Strengths</h3>
          </div>
          <ul className="space-y-3">
            {renderListItems(strengths, "bg-green-600")}
          </ul>
        </div>

        <div className="rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-foreground">Areas to Improve</h3>
          </div>
          <ul className="space-y-3">
            {renderListItems(improvements, "bg-orange-500")}
          </ul>
        </div>
      </div>

      {/* Applied Jobs Section */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">Applied Jobs</h2>
        <div className="space-y-4">
          {appliedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applied jobs found yet.</p>
          ) : (
            appliedJobs.map((job) => (
              <JobCard
                key={job.id}
                title={job.title}
                company={job.company}
                location={job.location}
                salary={job.salary}
                type={job.type}
                posted={job.posted}
                applied
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserInsights;