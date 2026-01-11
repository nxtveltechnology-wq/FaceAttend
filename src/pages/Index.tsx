import { Link } from "react-router-dom";
import { Camera, GraduationCap, Shield, Users } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-border p-6">
        <div className="container mx-auto flex items-center gap-3">
          <div className="w-12 h-12 bg-primary flex items-center justify-center">
            <Camera className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">FaceAttend</h1>
            <p className="text-sm text-muted-foreground">Smart Attendance System</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Face Recognition
              <br />
              Attendance System
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Modern, secure, and efficient attendance tracking powered by AI face recognition technology.
            </p>
          </div>

          {/* Navigation Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Student Attendance */}
            <Link
              to="/attendance"
              className="group block border-2 border-border bg-card p-8 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-16 h-16 bg-primary flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <GraduationCap className="w-8 h-8 text-primary-foreground group-hover:text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">Student Attendance</h3>
              <p className="text-muted-foreground text-sm">
                Mark your attendance using face recognition. Quick and contactless.
              </p>
            </Link>

            {/* Teacher Login */}
            <Link
              to="/teacher/login"
              className="group block border-2 border-border bg-card p-8 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-16 h-16 bg-primary flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Users className="w-8 h-8 text-primary-foreground group-hover:text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">Teacher Login</h3>
              <p className="text-muted-foreground text-sm">
                Access class attendance, view reports, and manage students.
              </p>
            </Link>

            {/* Admin Login */}
            <Link
              to="/admin/login"
              className="group block border-2 border-border bg-card p-8 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-16 h-16 bg-primary flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Shield className="w-8 h-8 text-primary-foreground group-hover:text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">Admin Login</h3>
              <p className="text-muted-foreground text-sm">
                Manage system, students, teachers, and face datasets.
              </p>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div className="border-2 border-border p-4">
              <p className="text-3xl font-bold">99.2%</p>
              <p className="text-sm text-muted-foreground">Accuracy Rate</p>
            </div>
            <div className="border-2 border-border p-4">
              <p className="text-3xl font-bold">&lt;2s</p>
              <p className="text-sm text-muted-foreground">Recognition Time</p>
            </div>
            <div className="border-2 border-border p-4">
              <p className="text-3xl font-bold">24/7</p>
              <p className="text-sm text-muted-foreground">System Uptime</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-border p-6">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2026 FaceAttend. Secure Attendance Management.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
