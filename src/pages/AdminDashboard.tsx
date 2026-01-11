import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Users,
  GraduationCap,
  BookOpen,
  LogOut,
  Plus,
  Trash2,
  Loader2,
  Camera,
  Pencil,
} from "lucide-react";
import StudentRegistrationForm from "@/components/StudentRegistrationForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";
import { Student, Teacher, ClassItem } from "@/types";



const AdminDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form states
  const [newStudent, setNewStudent] = useState({ name: "", roll_number: "", class_id: "" });
  const [newTeacher, setNewTeacher] = useState({ name: "", email: "", password: "", subject: "" });
  const [newClass, setNewClass] = useState({ name: "" });
  const [faceImage, setFaceImage] = useState<File | null>(null);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const profile = profileData as { role: string } | null;

      if (profile?.role !== "admin") {
        navigate("/admin/login");
      }
    };
    checkAuth();
  }, [navigate]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        supabase.from("students").select("*, classes(name)").order("name"),
        supabase.from("teachers").select("*").order("name"),
        supabase.from("classes").select("*").order("name"),
      ]);

      if (studentsRes.data) setStudents(studentsRes.data as unknown as Student[]);
      if (teachersRes.data) setTeachers(teachersRes.data as unknown as Teacher[]);
      if (classesRes.data) setClasses(classesRes.data as unknown as ClassItem[]);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        console.log("Face models loaded");
      } catch (error) {
        console.error("Error loading face models:", error);
      }
    };
    loadModels();
  }, []);

  // Add student
  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.roll_number || !newStudent.class_id) {
      toast({ title: "Error", description: "Fill all required fields", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      let faceEmbedding: number[] | null = null;

      // Process face image if uploaded
      if (faceImage) {
        // 1. Generate Embedding
        try {
          const img = await faceapi.bufferToImage(faceImage);
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            faceEmbedding = Array.from(detection.descriptor);
            console.log("Face embedding generated");
          } else {
            toast({ 
              title: "Warning", 
              description: "No face detected in the photo. Student added without face recognition.", 
              variant: "destructive" 
            });
          }
        } catch (e) {
          console.error("Face detection error:", e);
          toast({ 
            title: "Warning", 
            description: "Failed to process face image. Student added without face recognition.", 
            variant: "destructive" 
          });
        }

        // 2. Upload to storage
        const fileName = `${Date.now()}-${newStudent.roll_number}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("face-images")
          .upload(fileName, faceImage);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        }
      }

      // 3. Save to Database
      const { error } = await supabase.from("students").insert([{
        name: newStudent.name,
        roll_number: newStudent.roll_number,
        class_id: newStudent.class_id,
        face_embedding: faceEmbedding ? JSON.stringify(faceEmbedding) : null, // Store as JSON/Array
      }]);

      if (error) throw error;

      toast({ title: "Success", description: "Student added successfully" });
      setIsAddStudentOpen(false);
      setNewStudent({ name: "", roll_number: "", class_id: "" });
      setFaceImage(null);

      // Refresh students
      const { data } = await supabase.from("students").select("*, classes(name)").order("name");
      if (data) setStudents(data as unknown as Student[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add student";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Add teacher
  const handleAddTeacher = async () => {
    if (!newTeacher.name || !newTeacher.email || !newTeacher.password || !newTeacher.subject) {
      toast({ title: "Error", description: "Fill all required fields", variant: "destructive" });
      return;
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newTeacher.email,
        password: newTeacher.password,
      });

      if (authError) throw authError;

      // Create teacher record
      const { error } = await supabase.from("teachers").insert([{
        id: authData.user?.id || '',
        name: newTeacher.name,
        email: newTeacher.email,
        subject: newTeacher.subject,
      }]);

      if (error) throw error;

      // Update profile role
      if (authData.user) {
        await supabase.from("profiles").upsert([{
          id: authData.user.id,
          role: "teacher",
        }]);
      }

      toast({ title: "Success", description: "Teacher added successfully" });
      setIsAddTeacherOpen(false);
      setNewTeacher({ name: "", email: "", password: "", subject: "" });

      // Refresh teachers
      const { data } = await supabase.from("teachers").select("*").order("name");
      if (data) setTeachers(data as unknown as Teacher[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add teacher";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Add class
  const handleAddClass = async () => {
    if (!newClass.name) {
      toast({ title: "Error", description: "Class name is required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("classes").insert([{ name: newClass.name }]);
      if (error) throw error;

      toast({ title: "Success", description: "Class added successfully" });
      setIsAddClassOpen(false);
      setNewClass({ name: "" });

      // Refresh classes
      const { data } = await supabase.from("classes").select("*").order("name");
      if (data) setClasses(data as unknown as ClassItem[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add class";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Delete student
  const handleDeleteStudent = async (id: string) => {
    try {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;

      setStudents(students.filter((s) => s.id !== id));
      toast({ title: "Deleted", description: "Student removed" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Delete teacher
  const handleDeleteTeacher = async (id: string) => {
    try {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;

      setTeachers(teachers.filter((t) => t.id !== id));
      toast({ title: "Deleted", description: "Teacher removed" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">System Management</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Students
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{students.length}</span>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Teachers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{teachers.length}</span>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Classes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-3xl font-bold">{classes.length}</span>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="students">
              <TabsList className="mb-4">
                <TabsTrigger value="students">Students</TabsTrigger>
                <TabsTrigger value="teachers">Teachers</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
              </TabsList>

              {/* Students Tab */}
              <TabsContent value="students">
                <Card className="border-2 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Students</CardTitle>
                    <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Student
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Add New Student</DialogTitle>
                        </DialogHeader>
                        <StudentRegistrationForm
                          classes={classes}
                          onSuccess={() => {
                            setIsAddStudentOpen(false);
                            // Refresh students
                            supabase
                              .from("students")
                              .select("*, classes(name)")
                              .order("name")
                              .then(({ data }) => {
                                if (data) setStudents(data as unknown as Student[]);
                              });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Roll No</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Face Enrolled</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.roll_number}</TableCell>
                            <TableCell>{student.classes?.name || "-"}</TableCell>
                            <TableCell>
                              {student.face_embedding ? (
                                <span className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1">
                                  <Camera className="w-3 h-3" />
                                  Yes
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingStudent(student)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteStudent(student.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {students.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No students added yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Edit Student Dialog */}
                <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Student Details</DialogTitle>
                    </DialogHeader>
                    {editingStudent && (
                      <StudentRegistrationForm
                        classes={classes}
                        initialData={editingStudent}
                        onSuccess={() => {
                          setEditingStudent(null);
                          // Refresh students
                          supabase
                            .from("students")
                            .select("*, classes(name)")
                            .order("name")
                            .then(({ data }) => {
                              if (data) setStudents(data as unknown as Student[]);
                            });
                        }}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Teachers Tab */}
              <TabsContent value="teachers">
                <Card className="border-2 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Teachers</CardTitle>
                    <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Teacher
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Teacher</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={newTeacher.name}
                              onChange={(e) =>
                                setNewTeacher({ ...newTeacher, name: e.target.value })
                              }
                              placeholder="Teacher name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={newTeacher.email}
                              onChange={(e) =>
                                setNewTeacher({ ...newTeacher, email: e.target.value })
                              }
                              placeholder="teacher@school.edu"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                              type="password"
                              value={newTeacher.password}
                              onChange={(e) =>
                                setNewTeacher({ ...newTeacher, password: e.target.value })
                              }
                              placeholder="Initial password"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                              value={newTeacher.subject}
                              onChange={(e) =>
                                setNewTeacher({ ...newTeacher, subject: e.target.value })
                              }
                              placeholder="Mathematics"
                            />
                          </div>
                          <Button onClick={handleAddTeacher} className="w-full">
                            Add Teacher
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teachers.map((teacher) => (
                          <TableRow key={teacher.id}>
                            <TableCell className="font-medium">{teacher.name}</TableCell>
                            <TableCell>{teacher.email}</TableCell>
                            <TableCell>{teacher.subject}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTeacher(teacher.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {teachers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No teachers added yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Classes Tab */}
              <TabsContent value="classes">
                <Card className="border-2 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Manage Classes</CardTitle>
                    <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Class
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Class</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Class Name</Label>
                            <Input
                              value={newClass.name}
                              onChange={(e) =>
                                setNewClass({ ...newClass, name: e.target.value })
                              }
                              placeholder="e.g., Grade 10-A"
                            />
                          </div>
                          <Button onClick={handleAddClass} className="w-full">
                            Add Class
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      {classes.map((c) => (
                        <div
                          key={c.id}
                          className="border-2 border-border p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen className="w-5 h-5" />
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </div>
                      ))}
                      {classes.length === 0 && (
                        <div className="col-span-3 text-center text-muted-foreground py-8">
                          No classes added yet
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
