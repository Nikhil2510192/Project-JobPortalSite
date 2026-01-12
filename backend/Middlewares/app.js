import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import routes from "../routes/routes.js";

const app = express()

// FIXED CORS configuration:
const corsOptions = {
  // Replace the wildcard '*' with your actual Netlify URL
  origin: "https://jobboardingplatform.netlify.app", 
  
  // This is the missing piece causing your error
  credentials: true, 
  
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser())

app.get("/", (req, res) => {
  res.status(200).json({ message: "Job Portal API is running", status: "ok" });
});

app.use("/api", routes)
app.use(express.static("public"))

export default app;
