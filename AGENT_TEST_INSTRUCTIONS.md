# Syllabus Parser → Structured Plan Agent - Test Instructions

## Overview
This implementation adds a multi-step agent that processes PDF syllabi through Extract → Structure → Plan → Save stages with live progress tracking.

## Features Added

### Backend (`/server`)
1. **New Route**: `server/routes/agent.js`
   - `POST /agent/syllabus-plan/start` - Starts syllabus processing job
   - `GET /agent/jobs/:jobId` - Gets job status and progress
   - `POST /agent/jobs/:jobId/retry` - Retries failed job
   
2. **Updated**: `server/index.js` 
   - Added agent routes import and mounting

3. **Updated**: `server/models/History.js`
   - Added metadata field for tracking job information

### Frontend (`/client`)
1. **New Component**: `src/components/AutoPlanAgentModal.js`
   - Multi-step progress visualization
   - Real-time job status polling
   - Error handling and retry functionality
   - Success state with "View Plan" button

2. **Updated**: `src/App.js`
   - Integration with agent for authenticated users
   - Fallback to direct generation for non-authenticated users
   - Agent modal state management

3. **Updated**: `src/components/navbar.js`
   - Running job indicator badge

4. **Updated**: `src/styles/autosuggest.css`
   - Comprehensive styling for agent modal
   - Step progress indicators
   - Action buttons and states

## Manual Testing Instructions

### Prerequisites
1. Ensure MongoDB is running and accessible
2. Have valid GEMINI_API_KEY in server/.env
3. Have a test PDF syllabus file ready

### Test Scenarios

#### 1. Happy Path (Authenticated User)
```bash
# Start both servers
cd server && npm start
cd client && npm start
```

1. Navigate to http://localhost:3000
2. Click "Sign In" and create an account or login
3. Upload a PDF syllabus
4. Observe the agent modal opening with live progress:
   - Extract → Running → Success
   - Structure → Running → Success  
   - Plan → Running → Success
   - Save → Running → Success
5. Click "View Study Plan" to see generated modules
6. Verify running badge appears in navbar during processing
7. Check that history entry was created

#### 2. Error Handling
```bash
# Temporarily break Gemini API (invalid key in .env)
GEMINI_API_KEY=invalid_key
```

1. Upload PDF with invalid API key
2. Observe failure at "Structure" step
3. Test retry functionality
4. Restore valid API key and retry
5. Verify successful completion

#### 3. Non-Authenticated User Fallback
1. Open site without logging in
2. Upload PDF
3. Verify direct task generation (no agent modal)
4. Confirm functionality works normally

#### 4. Job Timeout
1. Upload very large PDF (>50MB if possible)
2. Observe 30-second timeout handling

### API Testing with Curl

```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# Start a job
JOB_ID=$(curl -s -X POST http://localhost:5000/agent/syllabus-plan/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pdfText":"Sample syllabus content for testing..."}' \
  | jq -r '.jobId')

# Check job status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/agent/jobs/$JOB_ID

# Retry failed job
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/agent/jobs/$JOB_ID/retry
```

### Expected Results

#### Agent Modal Behavior
- ✅ Shows 4 steps with pending/running/success/error states
- ✅ Real-time progress updates every 1 second
- ✅ Spinner animations for running steps
- ✅ Detailed error messages on failure
- ✅ Retry functionality for failed steps
- ✅ Success state with plan preview button

#### Integration
- ✅ Seamless transition to generated study plan
- ✅ History entry created with job metadata
- ✅ Running badge visible during processing
- ✅ Graceful fallback for non-authenticated users

#### Error Cases
- ✅ Network errors handled gracefully
- ✅ Invalid PDF content handled
- ✅ Gemini API failures caught and displayed
- ✅ Job timeout after 30 seconds
- ✅ Database save failures handled

### Performance Notes
- Jobs auto-cleanup after 5 minutes
- In-memory job store (suitable for single-instance dev)
- 30-second timeout per job
- 1-second polling interval for UI updates

### Security Considerations
- ✅ Authentication required for agent features
- ✅ Job ownership verification
- ✅ Input validation on PDF text
- ✅ Rate limiting inherited from existing auth middleware
- ✅ No API keys logged to console

## Production Deployment Notes
- Replace in-memory job store with Redis/Database for multi-instance
- Add job queue system (Bull, Agenda) for better reliability
- Implement webhooks for real-time updates instead of polling
- Add job priority and resource management
- Monitor job completion rates and performance metrics
