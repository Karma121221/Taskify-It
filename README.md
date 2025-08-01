# Taskify It - Syllabus to Study Plan Converter

Taskify It is a comprehensive web application that transforms syllabus PDFs into actionable study plans. The application helps students and learners by automating the process of breaking down course materials into manageable tasks with deadlines.

## ✨ Key Features

### 📱 Client Application (React Frontend)
- **Interactive User Interface**:
  - Modern React-based interface with responsive design
  - Custom CSS styling for optimal user experience
  - Progress visualization with completion tracking
- **Core Functionality**:
  - Secure PDF upload and processing
  - Task management system with completion status
  - Deadline setting and reminders
  - Dashboard for tracking study progress
  - PDF export functionality for offline use
- **State Management**:
  - Persistent storage using `localStorage` for user data
  - Real-time updates for task completion status

### ⚙️ Server Application (Express Backend)
- **File Processing**:
  - PDF upload handling via `multer` middleware
  - Text extraction from PDFs using `pdf-parse`
- **AI-Powered Task Generation**:
  - Integration with Gemini API for intelligent task creation
  - Automated resource suggestion based on syllabus content
- **Document Generation**:
  - PDF creation from study plans using `puppeteer`
- **Data Persistence**:
  - MongoDB Atlas integration via `mongoose` ODM
  - Secure storage of user data and study plans

## 🛠 Technology Stack

| Category        | Technologies                          |
|-----------------|---------------------------------------|
| Frontend        | React, React DOM, React Scripts       |
| Backend         | Express.js                            |
| Database        | MongoDB (via Mongoose)                |
| File Processing | Multer, pdf-parse                     |
| PDF Generation  | Puppeteer                             |
| API Integration | Axios (Gemini API)                    |
| Utilities       | CORS, dotenv                          |

## 🔐 Environment Configuration

The application requires the following environment variables:

- `MONGO_URI`: MongoDB connection string (e.g., `mongodb+srv://user:password@cluster.mongodb.net/dbname`)
- `GEMINI_API_KEY`: Your Gemini API key for AI task generation

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```