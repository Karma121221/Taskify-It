const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const History = require('../models/History');
const crypto = require('crypto');

const router = express.Router();

// In-memory job store for dev
const jobs = new Map();

// Helper to clean plan data before saving
const cleanPlanData = (planData) => {
  if (!planData || !planData.modules) return { modules: [] };
  
  const cleanedModules = planData.modules.map(module => ({
    topic: module.topic || 'Untitled Topic',
    tasks: (module.tasks || []).map(task => ({
      description: task.description || 'No description',
      resources: (task.resources || []).map(resource => ({
        title: resource.title || 'Resource',
        url: resource.url || '#'
      })).filter(resource => resource.title && resource.title !== '')
    }))
  }));
  
  return {
    ...planData,
    modules: cleanedModules
  };
};
const updateJobProgress = (jobId, stepName, status, detail = null, result = null) => {
  const job = jobs.get(jobId);
  if (!job) return;

  const stepIndex = job.steps.findIndex(step => step.name === stepName);
  if (stepIndex >= 0) {
    job.steps[stepIndex].status = status;
    job.steps[stepIndex].detail = detail;
  }

  job.status = status === 'error' ? 'error' : 
               job.steps.every(s => s.status === 'success') ? 'success' : 'running';
  
  if (result) {
    job.result = result;
  }
  
  job.updatedAt = new Date();
};

// Call Gemini API to structure syllabus
const callGeminiStructure = async (pdfText) => {
  const prompt = `You are a syllabus parser. Extract the following structured information from this syllabus text and return ONLY valid JSON:

{
  "course": { 
    "title": "string (course name/title)", 
    "instructor": "string (instructor name if found)" 
  },
  "timeline": [
    { "date": "string (any dates mentioned)", "what": "string (what happens on that date)" }
  ],
  "topics": [
    { "topic": "string (main topic/chapter/module)", "notes": "string (any additional details)" }
  ],
  "assessments": [
    { "name": "string (exam/assignment name)", "due": "string (due date if found)", "weight": "string (percentage/points if found)" }
  ],
  "policies": ["string (important policies/rules)"]
}

Extract dates, topics, assignments, exams, and important policies. Be comprehensive but accurate.

Syllabus text:
${pdfText}`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    const generatedText = response.data.candidates[0].content.parts[0].text;
    
    // Clean and parse JSON
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Gemini structuring error:', error.message);
    throw new Error('Failed to structure syllabus content');
  }
};

// Call Gemini API to generate tasks
const callGeminiTasks = async (structuredData) => {
  const topicsText = structuredData.topics.map(t => t.topic).join(', ');
  const assessmentsText = structuredData.assessments.map(a => a.name).join(', ');
  
  const prompt = `Based on this structured syllabus data, create a comprehensive study plan with modules and tasks.

Course: ${structuredData.course.title || 'Unknown Course'}
Topics: ${topicsText}
Assessments: ${assessmentsText}

Create modules that logically group related topics, and for each module provide specific, actionable study tasks with helpful resources.

Return your response as a JSON object with this exact structure:
{
  "title": "Study Plan for [Course Name]",
  "modules": [
    {
      "topic": "Module/Topic Name",
      "tasks": [
        {
          "description": "Specific actionable task",
          "resources": [
            {
              "title": "Resource name",
              "url": "https://example.com or search term"
            }
          ]
        }
      ]
    }
  ]
}

Make tasks specific and actionable. Provide 3-5 modules with 2-4 tasks each. Include relevant online resources (YouTube, Khan Academy, etc.) or search terms.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    const generatedText = response.data.candidates[0].content.parts[0].text;
    
    // Clean and parse JSON
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Gemini task generation error:', error.message);
    throw new Error('Failed to generate study tasks');
  }
};

// Async job processor
const processJob = async (jobId, pdfText, userId) => {
  try {
    // Step 1: Extract (normalize PDF text)
    updateJobProgress(jobId, 'Extract', 'running', 'Normalizing PDF content...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
    
    const extractedText = pdfText.trim().replace(/\s+/g, ' ').substring(0, 50000); // Normalize and limit
    updateJobProgress(jobId, 'Extract', 'success', 'Text normalized successfully');

    // Step 2: Structure (call Gemini to extract structured data)
    updateJobProgress(jobId, 'Structure', 'running', 'Analyzing syllabus structure...');
    const structuredData = await callGeminiStructure(extractedText);
    updateJobProgress(jobId, 'Structure', 'success', 'Structure extracted successfully');

    // Step 3: Plan (generate tasks)
    updateJobProgress(jobId, 'Plan', 'running', 'Generating study plan...');
    const planData = await callGeminiTasks(structuredData);
    updateJobProgress(jobId, 'Plan', 'success', 'Study plan generated');

    // Step 4: Save (persist to database)
    updateJobProgress(jobId, 'Save', 'running', 'Saving to history...');
    
    // Clean the plan data before saving
    const cleanedPlanData = cleanPlanData(planData);
    
    const historyEntry = new History({
      userId: userId,
      title: cleanedPlanData.title || 'Syllabus Study Plan',
      modules: cleanedPlanData.modules || [],
      metadata: {
        jobId: jobId,
        structuredData: structuredData,
        source: 'syllabus-agent'
      }
    });
    
    await historyEntry.save();
    
    updateJobProgress(jobId, 'Save', 'success', 'Saved to history', {
      historyId: historyEntry._id,
      planData: cleanedPlanData
    });

  } catch (error) {
    console.error(`Job ${jobId} error:`, error.message);
    const currentStep = jobs.get(jobId)?.steps.find(s => s.status === 'running')?.name || 'Unknown';
    updateJobProgress(jobId, currentStep, 'error', error.message);
  }
};

// Validation
const startJobValidation = [
  body('pdfText')
    .trim()
    .isLength({ min: 100 })
    .withMessage('PDF text must be at least 100 characters')
];

// Routes
router.post('/syllabus-plan/start', authenticate, startJobValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { pdfText } = req.body;
    const userId = req.user.id;
    
    // Generate job ID
    const jobId = crypto.randomBytes(16).toString('hex');
    
    // Initialize job
    const job = {
      id: jobId,
      userId: userId,
      status: 'pending',
      steps: [
        { name: 'Extract', status: 'pending', detail: null },
        { name: 'Structure', status: 'pending', detail: null },
        { name: 'Plan', status: 'pending', detail: null },
        { name: 'Save', status: 'pending', detail: null }
      ],
      result: null,
      originalInput: pdfText, // Store for retry
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    jobs.set(jobId, job);
    
    // Start async processing
    setImmediate(() => processJob(jobId, pdfText, userId));
    
    // Set timeout to clean up job after 30 seconds
    setTimeout(() => {
      if (jobs.has(jobId)) {
        const currentJob = jobs.get(jobId);
        if (currentJob.status === 'pending' || currentJob.status === 'running') {
          updateJobProgress(jobId, 'timeout', 'error', 'Job timed out after 30 seconds');
        }
        // Clean up after additional 5 minutes
        setTimeout(() => jobs.delete(jobId), 300000);
      }
    }, 30000);
    
    res.json({
      status: 'success',
      jobId: jobId
    });

  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start syllabus processing job'
    });
  }
});

router.get('/jobs/:jobId', authenticate, (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }
    
    // Verify user owns this job
    if (job.userId !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }
    
    res.json({
      status: 'success',
      job: {
        id: job.id,
        status: job.status,
        steps: job.steps,
        result: job.result,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve job status'
    });
  }
});

// Retry failed job from failed step
router.post('/jobs/:jobId/retry', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }
    
    if (job.userId !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }
    
    // Reset failed steps to pending
    job.steps.forEach(step => {
      if (step.status === 'error') {
        step.status = 'pending';
        step.detail = null;
      }
    });
    
    job.status = 'pending';
    job.updatedAt = new Date();
    
    // Restart processing with original input
    if (job.originalInput) {
      setImmediate(() => processJob(jobId, job.originalInput, job.userId));
    }
    
    res.json({
      status: 'success',
      message: 'Job retry initiated'
    });

  } catch (error) {
    console.error('Retry job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retry job'
    });
  }
});

module.exports = router;
