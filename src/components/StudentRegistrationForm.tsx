import { useState, useRef, useEffect } from "react";
import { Loader2, Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";

interface ClassItem {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class_id?: string;
  face_embedding?: string | null;
}

interface StudentRegistrationFormProps {
  classes: ClassItem[];
  onSuccess: () => void;
  initialData?: Student | null;
}

const StudentRegistrationForm = ({ classes, onSuccess, initialData }: StudentRegistrationFormProps) => {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  
  // Media handling
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { toast } = useToast();

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Populate form if initialData provided
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setRollNumber(initialData.roll_number);
      setClassId(initialData.class_id || "");
      // We don't pre-fill image/preview as it's complex to load securely/efficiently here, 
      // user will upload NEW one if they want to change it.
    }
  }, [initialData]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        setImageFile(null);
        setImagePreview(null);
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast({ title: "Error", description: "Failed to access camera", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            stopCamera();
          }
        }, "image/jpeg");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      stopCamera();
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    stopCamera();
    setStatus("idle");
    setStatusMessage("");
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!name || !rollNumber || !classId) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    // Capture photo if required
    if (!initialData && !imageFile) {
        toast({ title: "Error", description: "Face photo is required for new students", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    setStatus("processing");
    setStatusMessage(initialData ? "Updating details..." : "Analyzing face...");

    try {
      let embedding: number[] | null = null;
      let hasNewFace = false;

      // 1. Process Face ONLY if new image provided
      if (imageFile) {
        setStatusMessage("Analyzing new face...");
        const img = await faceapi.bufferToImage(imageFile);
        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            setStatus("error");
            setStatusMessage("No face detected in new photo!");
            toast({ title: "Training Failed", description: "No face detected in the image.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        embedding = Array.from(detection.descriptor);
        hasNewFace = true;
        
        // Upload Image
        const fileName = `${Date.now()}-${rollNumber}.jpg`;
        const { error: uploadError } = await supabase.storage
            .from("face-images")
            .upload(fileName, imageFile);
            
        if (uploadError) throw uploadError;
      }

      // 2. Database Operation
      const studentData: any = {
        name,
        roll_number: rollNumber,
        class_id: classId,
      };

      if (hasNewFace && embedding) {
        studentData.face_embedding = JSON.stringify(embedding);
      }

      let dbError;
      
      if (initialData?.id) {
        // UPDATE
        const { error } = await supabase
            .from("students")
            .update(studentData)
            .eq("id", initialData.id);
        dbError = error;
      } else {
        // INSERT
        const { error } = await supabase
            .from("students")
            .insert([studentData]);
        dbError = error;
      }

      if (dbError) throw dbError;

      setStatus("success");
      setStatusMessage(initialData ? "Updated successfully!" : "Registered successfully!");
      toast({ 
        title: "Success", 
        description: initialData ? "Student details updated" : "Student registered successfully" 
      });
      
      // Reset if creating new, keep if editing (or close dialog via parent)
      if (!initialData) {
          setName("");
          setRollNumber("");
          setClassId("");
          clearImage();
      }
      onSuccess();

    } catch (error: unknown) {
      console.error("Operation error:", error);
      setStatus("error");
      const message = error instanceof Error ? error.message : "Failed to process request";
      setStatusMessage(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student Name" />
      </div>
      
      <div className="space-y-2">
        <Label>Roll Number</Label>
        <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="Roll Number" />
      </div>

      <div className="space-y-2">
        <Label>Class</Label>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger>
            <SelectValue placeholder="Select Class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Face Photo {initialData ? "(Optional for Update)" : "(Required for Training)"}</Label>
        <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px] bg-muted/30">
          
          {cameraActive ? (
            <div className="relative w-full aspect-video bg-black rounded overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <Button type="button" onClick={capturePhoto} variant="destructive">
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
              </div>
            </div>
          ) : imagePreview ? (
            <div className="relative w-full aspect-video bg-black rounded overflow-hidden group">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button type="button" variant="destructive" size="icon" onClick={clearImage}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={startCamera}>
                  <Camera className="w-4 h-4 mr-2" />
                  Use Webcam
                </Button>
                <div className="relative">
                  <Button type="button" variant="outline" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Upload or capture a clear front-facing photo.</p>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className={`text-sm font-medium ${
            status === 'error' ? 'text-destructive' : 
            status === 'success' ? 'text-green-600' : 'text-primary'
          } flex items-center gap-2 mt-2`}>
            {status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
            {statusMessage}
          </div>
        )}
      </div>

      <Button onClick={handleSubmit} className="w-full" disabled={isLoading || (!initialData && !imageFile)}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          initialData ? "Update Student Details" : "Register Student & Train Face"
        )}
      </Button>
    </div>
  );
};

export default StudentRegistrationForm;
