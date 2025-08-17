const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const axios = require('axios');
const puppeteer = require('puppeteer');
const helmet = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss');
const compression = require('compression');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const agentRoutes = require('./routes/agent');

const app = express();

// Trust proxy - IMPORTANT: Add this early, before other middleware
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Custom middleware for NoSQL injection sanitization (Express v5 compatible)
app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});

// Custom XSS protection middleware
app.use((req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
});

// Helper function to sanitize objects recursively
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return xss(obj);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

// Compression middleware
app.use(compression());

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin === 'http://localhost:3000' || origin === 'http://localhost:3001') {
      return callback(null, true);
    }
    
    // Allow production client URL
    if (process.env.NODE_ENV === 'production' && origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    
    // Allow Vercel deployments
    if (origin && origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Allow Render deployments
    if (origin && origin.includes('onrender.com')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
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
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to Taskify It API',
    version: '1.0.0'
  });
});

// Connect to MongoDB Atlas with better configuration
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  console.log('📊 Database Name:', mongoose.connection.db.databaseName);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// MongoDB connection events
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  try {
    // Close MongoDB connection without callback (Mongoose v8+)
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

// Routes
app.use('/auth', authRoutes);
app.use('/history', historyRoutes);
app.use('/agent', agentRoutes);

// 📁 Set up multer for file upload with better error handling
const upload = multer({ 
  dest: '/tmp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File size too large. Maximum file size is 10MB.'
      });
    }
  }
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid file type. Only PDF files are allowed.'
    });
  }
  
  next(error);
});

// 📄 Route: Upload + parse PDF
app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded. Please select a PDF file.'
      });
    }

    // Parse PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path);
    
    // Return extracted text
    res.json({
      status: 'success',
      message: 'PDF uploaded and parsed successfully',
      data: {
        text: data.text,
        numPages: data.numpages,
        info: data.info
      }
    });
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // Clean up temporary file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to process PDF. Please try again with a valid PDF file.'
    });
  }
});

// 🤖 Route: Generate tasks using Gemini API
app.post('/generate-tasks', async (req, res) => {
  try {
    const { syllabusText } = req.body;
    
    if (!syllabusText) {
      return res.status(400).json({
        status: 'error',
        message: 'Syllabus text is required'
      });
    }

    // Check if syllabus text is too short
    if (syllabusText.trim().length < 50) {
      return res.status(400).json({
        status: 'error',
        message: 'Syllabus text is too short. Please provide a more detailed syllabus.'
      });
    }

    // Prepare prompt for Gemini API
    const prompt = `You are an educational assistant that helps students organize their study materials. 
    Based on the following syllabus, create a structured study plan with topics, subtopics, and tasks.
    
    Syllabus:
    ${syllabusText}
    
    Please provide the response in the following JSON format:
    {
      "topics": [
        {
          "topic": "Main topic name",
          "tasks": [
            {
              "description": "Specific task or subtopic to study",
              "resources": [
                {
                  "title": "Resource title",
                  "url": "https://example.com"
                }
              ]
            }
          ]
        }
      ]
    }
    
    Guidelines:
    1. Break down the syllabus into 3-7 main topics
    2. Each topic should have 3-8 specific tasks
    3. Include relevant online resources for each task (2-4 per task)
    4. Make tasks actionable and specific
    5. Focus on understanding concepts rather than just reading
    6. Provide diverse resource types (videos, articles, tutorials)
    7. Ensure all URLs are valid and accessible
    8. Return ONLY valid JSON, no other text`;

    // Call Gemini API with the new endpoint
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 4096,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Extract and parse the response
    const geminiResponse = response.data;
    let textResponse = '';
    
    if (geminiResponse.candidates && geminiResponse.candidates[0].content) {
      textResponse = geminiResponse.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response format from Gemini API');
    }

    // Extract JSON from response (remove any markdown formatting)
    let jsonString = textResponse.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.substring(7, jsonString.length - 3);
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.substring(3, jsonString.length - 3);
    }

    // Parse JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', textResponse);
      throw new Error('Failed to parse response from AI. Please try again.');
    }

    // Validate response structure
    if (!parsedResponse.topics || !Array.isArray(parsedResponse.topics)) {
      throw new Error('Invalid response structure from AI');
    }

    // Validate each topic
    parsedResponse.topics.forEach((topic, index) => {
      if (!topic.topic || !topic.tasks || !Array.isArray(topic.tasks)) {
        throw new Error(`Invalid topic structure at index ${index}`);
      }
      
      topic.tasks.forEach((task, taskIndex) => {
        if (!task.description) {
          throw new Error(`Task ${taskIndex} in topic ${index} missing description`);
        }
        
        if (task.resources && !Array.isArray(task.resources)) {
          throw new Error(`Invalid resources structure in task ${taskIndex} of topic ${index}`);
        }
      });
    });

    res.json({
      status: 'success',
      message: 'Study plan generated successfully',
      topics: parsedResponse.topics
    });

  } catch (error) {
    console.error('Task generation error:', error);
    
    // Handle specific error cases
    if (error.response) {
      // API error response
      if (error.response.status === 401) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid API key. Please contact the administrator.'
        });
      }
      
      if (error.response.status === 429) {
        return res.status(429).json({
          status: 'error',
          message: 'API rate limit exceeded. Please try again later.'
        });
      }

      if (error.response.status === 404) {
        return res.status(503).json({
          status: 'error',
          message: 'AI service is temporarily unavailable. Please try again later.'
        });
      }
    }
    
    // Generic error response
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate study plan. Please try again.'
    });
  }
});

// 📄 Route: Export tasks to PDF
app.post('/export-pdf', async (req, res) => {
  try {
    const { htmlContent } = req.body;
    
    if (!htmlContent) {
      return res.status(400).json({
        status: 'error',
        message: 'HTML content is required'
      });
    }

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded'
    });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    // Close browser
    await browser.close();
    
    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=study-plan.pdf');
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate PDF. Please try again.'
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 MongoDB URI configured: ${!!process.env.MONGO_URI}`);
  console.log(`🔑 Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`📧 Email configured: ${!!process.env.EMAIL_USER}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});
