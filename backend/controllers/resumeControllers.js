import  prisma  from '../db.config.js';
import { v2 as cloudinary } from "cloudinary";
import { analyzeResumeWithOpenAI } from "../utils/OpenAiApi.js";
import { pdfParser } from '../utils/pdfParser.js';



// POST /users/:id/resume
export const saveResume = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const { resumeUrl, cloudinaryId } = req.body;

    console.log("Received resume data:", { userId, resumeUrl, cloudinaryId });

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid or missing user id" });
    }

    if (!resumeUrl) {
      return res.status(400).json({ message: "resumeUrl is required" });
    }

    if (!cloudinaryId) {
      return res.status(400).json({ message: "cloudinaryId is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 1️⃣ Create resume row *without* waiting for pdfParser
    const resume = await prisma.resume.create({
      data: {
        user_id: userId,
        resumeUrl,
        cloudinaryId,
        // resumeText will be filled later
      },
    });

    console.log("Resume row created:", resume.id);

    // 2️⃣ Respond to frontend *immediately*
    res.status(201).json({
      message: "Resume saved. Processing text in background.",
      resumeId: resume.id,
    });

    // 3️⃣ After response, start heavy work in background (do NOT await)
    console.log("Starting PDF parsing for:", cloudinaryId);
    pdfParser({ cloudinaryId, resumeUrl })
  .then(async (resumeText) => {
    await prisma.resume.update({
      where: { id: resume.id },
      data: { resumeText },
    });
    console.log("Saved resumeText to DB for resume:", resume.id);

    console.log("Resume text saved:", resume.id);
  })
  .catch(err => {
    console.error("Resume parsing failed:", err);
  });

  } catch (error) {
    console.error("Error saving resume:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};














export const deleteResume = async (req, res) => {
  try {
    const resumeId = Number(req.params.resumeId);
    const userId = Number(req.user.id); // or from req.user.id if using auth

    if (!resumeId || Number.isNaN(resumeId)) {
      return res.status(400).json({ message: "Invalid or missing resume id" });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid or missing user id" });
    }

    // 1) Find the resume
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        user_id: true,
        cloudinaryId: true,
      },
    });

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // 2) Authorization: ensure it belongs to this user
    if (resume.user_id !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this resume" });
    }

    // 3) Delete from Cloudinary first
    // PDFs are usually uploaded as resource_type "raw"
    const cloudinaryResult = await cloudinary.uploader.destroy(resume.cloudinaryId, {
      resource_type: "raw",
    });

    console.log("Cloudinary delete result:", cloudinaryResult);


    // 4) Delete from DB
    await prisma.resume.delete({
      where: { id: resumeId },
    });

    return res.status(200).json({
      message: "Resume deleted from DB and Cloudinary",
      deletedResumeId: resumeId,
      cloudinaryResult,
    });
  } catch (error) {
    console.error("Error deleting resume:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};










export const analyzeResume = async (req, res) => {
  try {
    console.log("🧠 analyzeResume reached");
    console.log("🧠 analyzeResume controller entered");
    const resumeId = Number(req.params.resumeId);
    const userId = Number(req.user.id) || req.user?.id; // adjust based on your auth
   console.log("🔥 analyzeResume called. resumeId:", req.params.resumeId, "userId:", req.user?.id);

    if (!resumeId || Number.isNaN(resumeId)) {
      return res.status(400).json({ message: "Invalid or missing resume id" });
    }

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid or missing user id" });
    }

    // 1️⃣ Fetch resume from DB
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        user_id: true,
        resumeText: true,
        resumeScore: true,
        good: true,
        improve: true,
      },
    });

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Auth guard: ensure this resume belongs to this user
    if (resume.user_id !== userId) {
      return res.status(403).json({ message: "Not authorized to analyze this resume" });
    }

    if (!resume.resumeText || resume.resumeText.trim().length === 0) {
      return res.status(400).json({
        message: "resumeText is empty or not processed yet. Please wait for extraction.",
      });
    }

    // 2️⃣ Call Gemini with the resume text
    console.log("Sending resume to Gemini for analysis, resumeId:", resumeId);
    console.log("📄 resumeText length:", resume.resumeText?.length);
    console.time("AI_CALL");

    const { score, strengths, improvements } = await analyzeResumeWithOpenAI(
      resume.resumeText
    );
    console.timeEnd("AI_CALL");

    console.log("Gemini analysis result:", {
      score,
      strengthsPreview: strengths.slice(0, 80),
      improvementsPreview: improvements.slice(0, 80),
    });

    // 3️⃣ Save results in DB
    const updated = await prisma.resume.update({
      where: { id: resumeId },
      data: {
        resumeScore: score,
        good: JSON.stringify(strengths), 
        improve: JSON.stringify(improvements),
      },
      select: {
        id: true,
        resumeScore: true,
        good: true,
        improve: true,
      },
    });

    // 4) Return to frontend
    // We parse the strings back into arrays so the frontend .map() works
    return res.status(200).json({
      message: "Resume analyzed successfully",
      resumeId: updated.id,
      resumeScore: updated.resumeScore,
      good: JSON.parse(updated.good || "[]"),
      improve: JSON.parse(updated.improve || "[]"),
    });
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};





// Get current user's most recent resume
export const getMyResume = async (req, res) => {
  try {
    const userId = Number(req.user.id);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // Get the most recent resume for this user
    const resume = await prisma.resume.findFirst({
      where: { user_id: userId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        resumeUrl: true,
      }
    });

    if (!resume) {
      return res.status(404).json({ message: "No resume found for this user" });
    }

    return res.status(200).json({
      resumeId: resume.id,
      resumeUrl: resume.resumeUrl
    });

  } catch (error) {
    console.error("Error getting user resume:", error.message);
    return res.status(500).json({ message: "Failed to fetch resume" });
  }
};
