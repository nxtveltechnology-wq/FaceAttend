
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

interface FaceApiContextType {
  isModelsLoaded: boolean;
  loadError: string | null;
}

const FaceApiContext = createContext<FaceApiContextType>({
  isModelsLoaded: false,
  loadError: null,
});

export const useFaceApi = () => useContext(FaceApiContext);

export const FaceApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        if (isModelsLoaded) return;

        console.log("🔧 Loading face detection models globally...");
        const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          // faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Only if we switch to SSD (heavier but better)
        ]);

        console.log("✅ Face models loaded successfully (Global)");
        setIsModelsLoaded(true);
      } catch (error) {
        console.error("❌ Error loading face-api models:", error);
        setLoadError("Failed to load face recognition models. Please check your connection.");
      }
    };

    loadModels();
  }, []);

  return (
    <FaceApiContext.Provider value={{ isModelsLoaded, loadError }}>
      {children}
    </FaceApiContext.Provider>
  );
};
