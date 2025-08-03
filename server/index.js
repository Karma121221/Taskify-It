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

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [
          'https://taskify-it.vercel.app',
          /^https:\/\/taskify-it-.*\.vercel\.app$/,
          /^https:\/\/.*\.vercel\.app$/
        ]
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Taskify-It API is working!',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 🔗 Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/taskify', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// 📁 Set up multer for file upload with better error handling
const upload = multer({ 
  dest: '/tmp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }
  next(error);
});

// 📄 Route: Upload + parse PDF
app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    // Delete uploaded file after reading
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.warn('Warning: Could not delete temporary file:', unlinkError.message);
    }

    res.json({ text: pdfData.text });
  } catch (error) {
    console.error('Error processing PDF:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn('Warning: Could not delete temporary file after error:', unlinkError.message);
      }
    }
    
    res.status(500).json({ error: 'Failed to read PDF' });
  }
});

app.post('/generate-tasks', async (req, res) => {
  const { syllabusText } = req.body;

  if (!syllabusText) {
    return res.status(400).json({ error: 'Missing syllabus text' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
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
        timeout: 30000, // 30 second timeout
      }
    );

    if (!response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response from AI service');
    }

    let reply = response.data.candidates[0].content.parts[0].text;

    // Remove Markdown code block if present
    reply = reply.replace(/```json|```/g, '').trim();

    try {
      const cleaned = JSON.parse(reply);
      res.json({ topics: cleaned });
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      res.status(500).json({ error: 'Failed to parse AI response' });
    }

  } catch (err) {
    console.error('Task generation error:', err.message);
    if (err.response) {
      console.error('API Error Response:', err.response.data);
    }
    res.status(500).json({ error: 'Failed to generate tasks' });
  }
});

app.post('/export-pdf', async (req, res) => {
  const { htmlContent } = req.body;

  if (!htmlContent) {
    return res.status(400).json({ error: 'Missing HTML content' });
  }

  let browser;
  try {
    // Enhanced Puppeteer configuration for Render
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000,
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
      timeout: 30000,
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
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 MongoDB URI configured: ${!!process.env.MONGO_URI}`);
  console.log(`🔑 Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});
