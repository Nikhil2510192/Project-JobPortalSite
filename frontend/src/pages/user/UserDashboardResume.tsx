import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Trash2, Upload as UploadIcon, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type ResumeData = {
  resumeId: number;
  resumeUrl: string;
} | null;

const UserDashboardResume = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Fetch user's resume on component mount
  useEffect(() => {
    fetchMyResume();
  }, []);

  const fetchMyResume = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/resume/my`, {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 404) {
        // No resume found, that's okay
        setResumeData(null);
        return;
      }

      if (!res.ok) {
        let errorMessage = "Failed to fetch resume";
        try {
          const data = await res.json();
          errorMessage = data?.message || errorMessage;
        } catch {
          // If response is not JSON, use default message
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      setResumeData({
        resumeId: data.resumeId,
        resumeUrl: data.resumeUrl,
      });
    } catch (err: any) {
      console.error('Error fetching resume:', err);
      // Don't show error if it's just "no resume found" - this is expected
      const errorMessage = err.message || "Failed to load resume";
      if (!errorMessage.includes("No resume found") && !errorMessage.includes("not found")) {
        setError(errorMessage);
      }
    } finally {
      setFetching(false);
    }
  };

  const handleFileSelect = (selected: File | null) => {
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
  
    setLoading(true);
    setError(null);

    try {
      // 1) Get Signature with AUTO type
      const sigRes = await fetch(`${API_BASE_URL}/resume/signature`, {
        method: "GET",
        credentials: "include",
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData?.message || "Failed to get signature");
      const { signature, apiKey, cloudName, timestamp, folder } = sigData;

      // 2) Upload to Cloudinary as AUTO (not RAW)
      const cloudForm = new FormData();
      cloudForm.append("file", file);
      cloudForm.append("api_key", apiKey);
      cloudForm.append("timestamp", String(timestamp));
      cloudForm.append("folder", folder || "resumes");
      cloudForm.append("signature", signature);
      
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, 
        { 
          method: "POST", 
          body: cloudForm 
        }
      );
      
      const cloudJson = await cloudRes.json();
      if (!cloudRes.ok) {
        console.error('Cloudinary error:', cloudJson);
        throw new Error(cloudJson?.error?.message || "Cloudinary upload failed");
      }
      
      const { secure_url, public_id } = cloudJson;

      // 3) Save to Backend
      const saveRes = await fetch(`${API_BASE_URL}/resume/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          resumeUrl: secure_url, 
          cloudinaryId: public_id 
        }),
      });
      
      const data = await saveRes.json();
      if (!saveRes.ok) throw new Error(data?.message || "Save resume failed");

      // Update user state
      if (user) {
        const updatedUser = { ...user, resumeUploaded: true };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // Refresh resume data
      await fetchMyResume();
      setFile(null);
      setShowUploadForm(false);
      
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!resumeData) return;

    if (!window.confirm("Are you sure you want to delete your resume? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/resume/delete/${resumeData.resumeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete resume");

      // Update user state
      if (user) {
        const updatedUser = { ...user, resumeUploaded: false };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // Clear resume data
      setResumeData(null);
      setShowUploadForm(true);
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || "Failed to delete resume. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getFileExtension = (url: string) => {
    const match = url.match(/\.([a-z]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : 'pdf';
  };

  if (fetching) {
    return (
      <div className="max-w-4xl mx-auto animate-slide-up space-y-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">My Resume</h1>
          <p className="text-muted-foreground">Loading your resume...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-slide-up space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">My Resume</h1>
        <p className="text-muted-foreground">
          {resumeData ? "View and manage your resume" : "Upload your resume (PDF or DOCX supported)"}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {resumeData && !showUploadForm ? (
        // Display existing resume
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                  <FileText className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Resume</p>
                  <p className="text-sm text-muted-foreground">Uploaded successfully</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(resumeData.resumeUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>

            {/* Display resume in iframe */}
            <div className="mt-6 rounded-lg border border-border overflow-hidden bg-muted/30">
              {getFileExtension(resumeData.resumeUrl) === 'pdf' ? (
                <iframe
                  src={resumeData.resumeUrl}
                  className="w-full h-[600px] border-0"
                  title="Resume Preview"
                />
              ) : (
                <div className="p-8 text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Preview not available for this file type
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open(resumeData.resumeUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download to view
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Upload form
        <div className="space-y-6">
          {resumeData && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-lg">
              <p className="text-sm">
                Uploading a new resume will replace your existing one.
              </p>
            </div>
          )}
          <FileUpload onFileSelect={handleFileSelect} />

          {file && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  if (resumeData) {
                    setShowUploadForm(false);
                  }
                }}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                className="flex-1"
                disabled={loading || !file}
              >
                {loading ? (
                  "Uploading..."
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    {resumeData ? "Replace Resume" : "Upload Resume"}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={() => navigate("/user/home")} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        {resumeData && !showUploadForm && !file && (
          <Button
            variant="outline"
            onClick={() => {
              setShowUploadForm(true);
              setFile(null);
            }}
            className="flex-1"
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            Upload New Resume
          </Button>
        )}
      </div>
    </div>
  );
};

export default UserDashboardResume;