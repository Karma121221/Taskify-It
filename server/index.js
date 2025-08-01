const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const axios = require('axios');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 🔗 Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI);

mongoose.connection.once('open', () => {
  console.log('✅ Connected to MongoDB Atlas');
});

// 📁 Set up multer for file upload
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

// 📄 Route: Upload + parse PDF
app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    // Delete uploaded file after reading
    fs.unlinkSync(req.file.path);

    res.json({ text: pdfData.text });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Failed to read PDF' });
  }
});

app.post('/generate-tasks', async (req, res) => {
  const { syllabusText } = req.body;

  if (!syllabusText) {
    return res.status(400).json({ error: 'Missing syllabus text' });
  }

  try {
    const prompt = `
I have this syllabus content:

"${syllabusText.slice(0, 3000)}"

From it, extract:
1. 5–15 main topics/modules.
2. 3–5 action-based learning tasks per topic.
3. For each task, include 1–3 useful online study resources (official docs, YouTube tutorials, blog links, etc.).
4. Return the result as JSON like:

[
  {
    "topic": "Topic Name",
    "tasks": [
      {
        "description": "Task 1 description",
        "resources": [
          { "title": "Resource Title", "url": "https://..." }
        ]
      }
    ]
  }
]
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );


    let reply = response.data.candidates[0].content.parts[0].text;

    // Remove Markdown code block if present
    reply = reply.replace(/```json|```/g, '').trim();

    const cleaned = JSON.parse(reply);

    // ✅ Send response
    res.json({ topics: cleaned });

  } catch (err) {
    console.error('Task generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate tasks' });
  }
});


app.post('/export-pdf', async (req, res) => {
  const { htmlContent } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="study-plan.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF export failed:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});



// ✅ Test route
app.get('/', (req, res) => {
  res.send('API is working!');
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
