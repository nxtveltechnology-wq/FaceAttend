# FaceAttend - Smart Attendance Management System

**FaceAttend** is a modern, secure, and efficient web-based attendance management application primarily designed for educational institutions. It leverages **facial recognition technology** to streamline student registration, verification, and attendance tracking, reducing manual errors and saving time.

## 🚀 Key Features

- **Advanced Facial Recognition:**
  - **Face Training:** Register students by capturing their face via webcam or uploading a photo.
  - **Secure Storage:** Face embeddings are securely stored in a Supabase database.
  - **Live Attendance:** Students can mark attendance by simply looking at the camera.
- **Role-Based Access Control:**
  - **Admin Dashboard:** Full control to manage courses, classes, teachers, and students.
  - **Teacher Dashboard:** Manage assigned classes, view student lists, and track attendance.
  - **Student Portal:** View personal attendance records and profile validation.
- **Real-time Updates:** Instant feedback on registration and attendance status.
- **Modern UI/UX:** Built with **Tailwind CSS** and **Shadcn UI** for a clean, responsive, and professional interface.

## 🛠️ Technology Stack

- **Frontend Framework:** [React](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [Shadcn UI](https://ui.shadcn.com/)
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **AI/ML:** [face-api.js](https://github.com/justadudewhohacks/face-api.js/) for browser-based face detection and recognition.
- **Icons:** [Lucide React](https://lucide.dev/)

## 📂 Project Structure

```bash
├── public/
│   └── models/          # Pre-trained face-api.js models (shard & manifest files)
├── src/
│   ├── components/      # Reusable UI components (Forms, Tables, Charts)
│   ├── pages/           # Application pages (Dashboard, Login, Attendance)
│   ├── integrations/    # Supabase client and API configurations
│   └── App.tsx          # Main application entry point with Routing
├── .env                 # Environment variables (API Keys)
└── vite.config.ts       # Vite configuration
```

## ⚙️ Setup & Installation

Follow these steps to run the project locally.

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd classmate-connect-main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server

```bash
npm run dev
```

The application will launch at `http://localhost:8080` (or similar).

## 🚀 Building for Production

To create an optimized production build:

```bash
npm run build
```

This will generate a `dist` folder containing the compiled assets ready for deployment (e.g., on Vercel, Netlify, or any static host).

## 🔒 Security Note

This project uses client-side face recognition. While face embeddings are stored securely, ensure your Supabase Row Level Security (RLS) policies are correctly configured to protect student data.

---

&copy; 2026 FaceAttend. All rights reserved.
