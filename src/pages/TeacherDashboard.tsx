import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Calendar,
  LogOut,
  Download,
  BarChart3,
  GraduationCap,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import StudentRegistrationForm from "@/components/StudentRegistrationForm";
import { Plus, Pencil } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  time: string;
  status: string;
  students: {
    name: string;
    roll_number: string;
    class_id?: string;
  } | null;
}

interface ClassItem {
  id: string;
  name: string;
}

const TeacherDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<any[]>([]); // Using any for now, ideally interface
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0 });
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/teacher/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const profile = profileData as { role: string } | null;

      if (profile?.role !== "teacher") {
        navigate("/teacher/login");
      }
    };
    checkAuth();
  }, [navigate]);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from("classes").select("*").order("name");
      if (data) setClasses(data as ClassItem[]);
    };
    fetchClasses();
  }, []);

  // Fetch students
  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("*, classes(name)")
      .order("name");
    
    if (data) {
        setStudents(data);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Fetch attendance with realtime updates
  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          date,
          time,
          status,
          students (
            name,
            roll_number,
            class_id
          )
        `)
        .eq("date", dateFilter)
        .order("time", { ascending: false });

      if (error) {
        console.error("Error fetching attendance:", error);
      } else {
        // Filter by class if selected
        let filtered = (data || []) as unknown as AttendanceRecord[];
        if (selectedClass) {
          filtered = filtered.filter((a) => 
            a.students?.class_id === selectedClass
          );
        }
        setAttendance(filtered);
        
        // Calculate stats
        const present = filtered.filter((a) => a.status === "present").length;
        setStats({
          present,
          absent: filtered.length - present,
          total: filtered.length,
        });
      }
      setIsLoading(false);
    };

    fetchAttendance();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => fetchAttendance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter, selectedClass]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Name", "Roll Number", "Date", "Time", "Status"];
    const rows = attendance.map((a) => [
      a.students?.name || "",
      a.students?.roll_number || "",
      a.date,
      a.time,
      a.status,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${dateFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Attendance data exported to CSV.",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/teacher/login");
  };

  // Chart data
  const pieData = [
    { name: "Present", value: stats.present, color: "hsl(var(--chart-2))" },
    { name: "Absent", value: stats.absent, color: "hsl(var(--chart-1))" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Teacher Dashboard</h1>
              <p className="text-sm text-muted-foreground">Attendance Management</p>
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
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="students">Manage Students</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            {/* Filters */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val === "all" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={exportToCSV} variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Students
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    <span className="text-2xl font-bold">{stats.total}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Present
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-2xl font-bold">{stats.present}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Absent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    <span className="text-2xl font-bold">{stats.absent}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Attendance Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    <span className="text-2xl font-bold">
                      {stats.total > 0
                        ? Math.round((stats.present / stats.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Table Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Attendance Table */}
              <div className="lg:col-span-2">
                <Card className="border-2 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Today's Attendance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    ) : attendance.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No attendance records for this date.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Roll No</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendance.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.students?.name || "Unknown"}
                              </TableCell>
                              <TableCell>{record.students?.roll_number || "-"}</TableCell>
                              <TableCell>{record.time}</TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border ${
                                    record.status === "present"
                                      ? "bg-secondary"
                                      : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {record.status === "present" ? (
                                    <CheckCircle className="w-3 h-3" />
                                  ) : (
                                    <XCircle className="w-3 h-3" />
                                  )}
                                  {record.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Pie Chart */}
              <Card className="border-2 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Attendance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.total === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No data to display
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="flex justify-center gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3" style={{ background: "hsl(var(--chart-2))" }} />
                      <span className="text-sm">Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3" style={{ background: "hsl(var(--chart-1))" }} />
                      <span className="text-sm">Absent</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Manage Students Tab */}
          <TabsContent value="students">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Register Student</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add New Student</DialogTitle>
                    </DialogHeader>
                    <StudentRegistrationForm
                      classes={classes}
                      onSuccess={() => {
                         toast({ title: "Success", description: "Student registered successfully" });
                         fetchStudents(); // Refresh list
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="mt-6">
                  {students.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Use the "Add New Student" button to register students and train their face data.</p>
                      <p className="text-sm mt-2">Make sure to have a clear camera or photo ready.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Roll Number</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.roll_number}</TableCell>
                            <TableCell>{student.classes?.name || "N/A"}</TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setEditingStudent(student)}
                                  >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                  </Button>
                                </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

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
                          setEditingStudent(null); // Close dialog
                          fetchStudents(); // Refresh list
                        }}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default TeacherDashboard;
