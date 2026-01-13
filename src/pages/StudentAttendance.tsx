import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFaceApi } from "@/context/FaceApiContext";
import * as faceapi from "face-api.js";

type AttendanceStatus =
  | "idle"
  | "loading"
  | "scanning"
  | "success"
  | "error"
  | "already-marked";

interface RecognizedStudent {
  id: string;
  name: string;
  roll_number: string;
  class_name: string;
}

interface StudentWithEmbedding {
  id: string;
  name: string;
  roll_number: string;
  class_id: string;
  face_embedding: number[] | null;
  classes: { name: string } | null;
}

const StudentAttendance = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("loading");
  const [recognizedStudent, setRecognizedStudent] =
    useState<RecognizedStudent | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [detectionCount, setDetectionCount] = useState(0);
  const { toast } = useToast();
  const { isModelsLoaded, loadError } = useFaceApi();

  // Check if models loaded from global context
  useEffect(() => {
    if (loadError) {
      setStatus("error");
      setErrorMessage(loadError);
    } else if (isModelsLoaded) {
      setStatus("idle");
    }
  }, [isModelsLoaded, loadError]);

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      console.log("📷 Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      // Store stream in ref first
      streamRef.current = stream;
      setStatus("scanning");
      console.log("✅ Camera started successfully");
    } catch (error) {
      console.error("❌ Error accessing camera:", error);
      setStatus("error");
      setErrorMessage(
        "Failed to access camera. Please allow camera permissions."
      );
    }
  }, []);

  // Attach stream to video element when it becomes available
  useEffect(() => {
    if (status === "scanning" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    console.log("🛑 Camera stopped");
  }, []);

  // Face detection and recognition loop
  useEffect(() => {
    if (status !== "scanning" || !isModelsLoaded || !videoRef.current) return;

    let animationFrameId: number;
    let isRecognizing = false;

    const detectFaces = async () => {
      if (!videoRef.current || !canvasRef.current || isRecognizing) {
        animationFrameId = requestAnimationFrame(detectFaces);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState !== 4) {
        animationFrameId = requestAnimationFrame(detectFaces);
        return;
      }

      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      faceapi.matchDimensions(canvas, displaySize);

      try {
        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw detection boxes with green color
          resizedDetections.forEach((detection) => {
            const box = detection.detection.box;
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          });

          // Draw facial landmarks
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

          // Update detection count
          setDetectionCount(detections.length);
        }

        // If face detected, try to recognize
        if (detections.length > 0 && !isRecognizing) {
          console.log(
            `📸 ${detections.length} Face(s) detected! Attempting recognition...`
          );
          isRecognizing = true;
          await recognizeFace(detections[0].descriptor);
          isRecognizing = false;
        }
      } catch (error) {
        console.error("Face detection error:", error);
      }

      animationFrameId = requestAnimationFrame(detectFaces);
    };

    detectFaces();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [status, isModelsLoaded]);

  // Recognize face against database
  const recognizeFace = async (faceDescriptor: Float32Array) => {
    try {
      console.log("🔍 Fetching students from database...");

      const { data, error } = await supabase
        .from("students")
        .select(
          "id, name, roll_number, class_id, face_embedding, classes(name)"
        )
        .not("face_embedding", "is", null);

      const students = data as unknown as StudentWithEmbedding[] | null;

      if (error) {
        console.error("❌ Database error:", error);
        return;
      }

      if (!students?.length) {
        console.log("⚠️ No students with face embeddings found in database");
        return;
      }

      console.log(`✅ Found ${students.length} students with face embeddings`);

      let bestMatch: {
        student: StudentWithEmbedding;
        distance: number;
      } | null = null;

      for (const student of students) {
        if (!student.face_embedding) continue;

        try {
          const embeddingData =
            typeof student.face_embedding === "string"
              ? JSON.parse(student.face_embedding)
              : student.face_embedding;

          const storedDescriptor = new Float32Array(embeddingData);
          const distance = faceapi.euclideanDistance(
            faceDescriptor,
            storedDescriptor
          );

          console.log(
            `📊 ${student.name}: distance = ${distance.toFixed(
              3
            )} (threshold: 0.45)`
          );

          if (
            distance < 0.45 &&
            (!bestMatch || distance < bestMatch.distance)
          ) {
            bestMatch = { student, distance };
          }
        } catch (e) {
          console.error(`Error processing embedding for ${student.name}:`, e);
        }
      }

      if (bestMatch) {
        console.log(
          `✅ Match found! ${
            bestMatch.student.name
          } (distance: ${bestMatch.distance.toFixed(3)})`
        );
        await markAttendance(bestMatch.student);
      } else {
        console.log("❌ No matching student found (all distances > 0.45)");
      }
    } catch (error) {
      console.error("Recognition error:", error);
    }
  };

  // Mark attendance in database
  const markAttendance = async (student: StudentWithEmbedding) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      console.log(`📝 Checking attendance for ${student.name} on ${today}...`);

      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", student.id)
        .eq("date", today)
        .single();

      if (existing) {
        console.log(`ℹ️ Attendance already marked for ${student.name} today`);
        setStatus("already-marked");
        setRecognizedStudent({
          id: student.id,
          name: student.name,
          roll_number: student.roll_number,
          class_name: student.classes?.name || "Unknown",
        });
        stopCamera();
        return;
      }

      console.log(`✍️ Marking attendance for ${student.name}...`);

      const { error } = await supabase.from("attendance").insert([
        {
          student_id: student.id,
          date: today,
          time: new Date().toLocaleTimeString(),
          status: "present",
          device_id: navigator.userAgent.slice(0, 50),
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          console.log(
            `ℹ️ Attendance already marked for ${student.name} today (caught duplicate error)`
          );
          setStatus("already-marked");
          setRecognizedStudent({
            id: student.id,
            name: student.name,
            roll_number: student.roll_number,
            class_name: student.classes?.name || "Unknown",
          });
          stopCamera();
          toast({
            title: "Attendance Already Marked",
            description: `${student.name} is already present today.`,
            variant: "default", // or a warning variant if available
          });
          return;
        }
        console.error("❌ Database error marking attendance:", error);
        throw error;
      }

      console.log(`✅ Attendance marked successfully for ${student.name}!`);

      setStatus("success");
      setRecognizedStudent({
        id: student.id,
        name: student.name,
        roll_number: student.roll_number,
        class_name: student.classes?.name || "Unknown",
      });
      stopCamera();

      toast({
        title: "Attendance Marked!",
        description: `Welcome, ${student.name}!`,
      });
    } catch (error) {
      console.error("Error marking attendance:", error);
      setStatus("error");
      setErrorMessage("Failed to mark attendance. Please try again.");
    }
  };

  // Reset state
  const resetAttendance = () => {
    setStatus("idle");
    setRecognizedStudent(null);
    setErrorMessage("");
    setDetectionCount(0);
  };

  const handleManualVerify = async () => {
    if (!videoRef.current) return;

    try {
      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length > 0) {
        toast({
          title: "Verifying...",
          description: "Processing manual verification request...",
        });
        await recognizeFace(detections[0].descriptor);
      } else {
        toast({
          title: "No face detected",
          description: "Please position your face clearly in the camera frame.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Manual verification error:", error);
      toast({
        title: "Error",
        description: "Failed to verify. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-border p-4">
        <div className="container mx-auto flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Mark Attendance</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 max-w-2xl">
        <div className="border-2 border-border bg-card overflow-hidden">
          {/* Camera View */}
          {/* Camera View - Adjusted height for mobile to fit content */}
          <div className="relative aspect-video min-h-[400px] md:min-h-0 bg-muted">
            {status === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p className="text-muted-foreground">
                  Loading face recognition...
                </p>
              </div>
            )}

            {status === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                <Camera className="w-16 h-16 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  Position your face in front of the camera for automatic
                  attendance marking.
                </p>
                <Button onClick={startCamera} size="lg">
                  Start Camera
                </Button>
              </div>
            )}

            {status === "scanning" && (
              <div className="relative w-full h-full bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* Face Count Indicator & Instructions */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <div className="bg-black/70 border border-green-500/50 px-3 py-1.5 rounded-full inline-flex items-center gap-2 backdrop-blur-sm">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        detectionCount > 0
                          ? "bg-green-500 animate-pulse"
                          : "bg-yellow-500"
                      }`}
                    />
                    <span className="text-xs font-medium text-white">
                      {detectionCount > 0
                        ? "Face Detected"
                        : "Looking for face..."}
                    </span>
                  </div>
                </div>

                {/* Instructions Overlay */}

                {/* Capture Button Overlay */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center pb-4">
                  <Button
                    onClick={handleManualVerify}
                    className="bg-white text-black hover:bg-white/90 font-bold px-8 py-6 rounded-full shadow-lg border-4 border-white/20 transition-transform active:scale-95"
                    disabled={detectionCount === 0}
                  >
                    <div className="flex flex-col items-center">
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-xs uppercase tracking-wider">
                        Capture & Verify
                      </span>
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {status === "success" && recognizedStudent && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-4 md:p-8 animate-in fade-in zoom-in duration-300 overflow-y-auto">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-green-700">
                    Attendance Marked!
                  </h2>
                  <p className="text-muted-foreground">
                    Successfully verified.
                  </p>

                  <div className="bg-card border-2 border-border rounded-xl p-6 mt-6 text-left shadow-sm w-full max-w-sm mx-auto">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-semibold">
                        {recognizedStudent.name}
                      </span>

                      <span className="text-muted-foreground">Roll No:</span>
                      <span className="font-semibold">
                        {recognizedStudent.roll_number}
                      </span>

                      <span className="text-muted-foreground">Class:</span>
                      <span className="font-semibold">
                        {recognizedStudent.class_name}
                      </span>

                      <span className="text-muted-foreground">Time:</span>
                      <span className="font-semibold">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === "already-marked" && recognizedStudent && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-4 md:p-8 animate-in fade-in zoom-in duration-300 overflow-y-auto">
                <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle className="w-12 h-12 text-yellow-600" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-yellow-700">
                    Already Marked
                  </h2>
                  <p className="text-muted-foreground">
                    Attendance was already recorded.
                  </p>

                  <div className="bg-card border-2 border-border rounded-xl p-6 mt-6 text-left shadow-sm w-full max-w-sm mx-auto">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-semibold">
                        {recognizedStudent.name}
                      </span>

                      <span className="text-muted-foreground">Roll No:</span>
                      <span className="font-semibold">
                        {recognizedStudent.roll_number}
                      </span>

                      <span className="text-muted-foreground">Class:</span>
                      <span className="font-semibold">
                        {recognizedStudent.class_name}
                      </span>

                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-semibold">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background p-8 animate-in fade-in slide-in-from-bottom-5">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-red-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-destructive mb-2">
                    Verification Failed
                  </h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    {errorMessage}
                  </p>
                </div>
                <Button
                  onClick={() => setStatus("scanning")}
                  variant="outline"
                  className="mt-4 min-w-[150px]"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t-2 border-border">
            {(status === "success" ||
              status === "error" ||
              status === "already-marked") && (
              <Button onClick={resetAttendance} className="w-full" size="lg">
                Scan Another Student
              </Button>
            )}
            {status === "scanning" && (
              <Button
                onClick={() => {
                  stopCamera();
                  setStatus("idle");
                }}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 border-2 border-border p-4">
          <h3 className="font-bold mb-2">Instructions</h3>

          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-semibold text-sm mb-2">For Best Results:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Ensure good lighting on your face</li>
              <li>Center your face in the camera frame</li>
              <li>Remove glasses or mask if possible</li>
              <li>Look straight at the camera</li>
            </ul>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-4 border-2 border-border p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Open browser console (F12) to see detailed detection logs
          </p>
        </div>
      </main>
    </div>
  );
};

export default StudentAttendance;
