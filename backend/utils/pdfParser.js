// utils/pdfParser.js
import axios from "axios";
import { PDFParse } from "pdf-parse";

export async function pdfParser({ resumeUrl }) {
  console.log("🚀 PDF Parser starting...");
  console.log("🔗 resumeUrl:", resumeUrl);

  try {
    // 1) Download PDF from Cloudinary
    const response = await axios.get(resumeUrl, {
      responseType: "arraybuffer",
      timeout: 30000
    });

    console.log("✅ Downloaded resume. Bytes:", response.data.length);

    // 2) Create parser instance from buffer
    const parser = new PDFParse({
      data: response.data
    });

    // 3) Parse PDF
    const result = await parser.getText(); 
    await parser.destroy(); // free memory

    const text = result.text || "";

    console.log("✅ Extracted text length:", text.length);
    console.log("📝 First 200 chars:", text.slice(0, 200));

    return text.trim();

  } catch (err) {
    console.error("❌ pdfParser failed:", err.message);
    return "";
  }
}
