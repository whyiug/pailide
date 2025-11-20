import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Note: Since we can't install uuid in this prompt, I'll write a simple helper
import { Camera } from 'lucide-react';
import { generatePhotoCaption } from './services/geminiService';
import { PhotoCard } from './components/PhotoCard';
import { PhotoData, AppStatus } from './types';

// Simple UUID generator since we assume standard env without extra packages
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const SHUTTER_SOUND_URL = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=="; // Placeholder, using a short click context usually requires a real file. 
// Let's use a synthesized beep for "shutter" if possible, or just visual feedback.
// For the sake of "Excellent Visual Aesthetics", we will rely on the animation heavily.

function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [stagedPhoto, setStagedPhoto] = useState<PhotoData | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shutterAudioRef = useRef<HTMLAudioElement>(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3')); // Camera shutter sound

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1080 },
            height: { ideal: 1080 },
            facingMode: "user" 
          },
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStatus(AppStatus.CAMERA_READY);
      } catch (err) {
        console.error("Error accessing camera:", err);
        setStatus(AppStatus.ERROR);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePhoto = useCallback(async () => {
    if (status !== AppStatus.CAMERA_READY || stagedPhoto) return; // Prevent double shot if one is staging

    setStatus(AppStatus.TAKING_PHOTO);
    
    // Play sound
    if (shutterAudioRef.current) {
      shutterAudioRef.current.currentTime = 0;
      shutterAudioRef.current.play().catch(() => {});
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas to square to match aspect logic if needed, but we want portrait crop for the card
      // The card is 3:4. Let's crop the center 3:4 from the video.
      const targetWidth = 600;
      const targetHeight = 800;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Calculate crop to center the video
        const videoRatio = video.videoWidth / video.videoHeight;
        const targetRatio = targetWidth / targetHeight;
        
        let sourceWidth, sourceHeight, sourceX, sourceY;

        if (videoRatio > targetRatio) {
          sourceHeight = video.videoHeight;
          sourceWidth = sourceHeight * targetRatio;
          sourceX = (video.videoWidth - sourceWidth) / 2;
          sourceY = 0;
        } else {
          sourceWidth = video.videoWidth;
          sourceHeight = sourceWidth / targetRatio;
          sourceX = 0;
          sourceY = (video.videoHeight - sourceHeight) / 2;
        }

        // Flip context horizontally for mirror effect
        ctx.translate(targetWidth, 0);
        ctx.scale(-1, 1);

        ctx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        );

        const imageData = canvas.toDataURL('image/png');
        const newId = generateId();
        const now = new Date();
        
        const newPhoto: PhotoData = {
          id: newId,
          imageData,
          caption: '',
          timestamp: Date.now(),
          dateString: now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
          isDeveloping: true,
          isStaged: true,
          position: { x: 0, y: 0 }, // Relative to camera initially
          rotation: (Math.random() * 6) - 3 // Slight random tilt
        };

        setStagedPhoto(newPhoto);
        setStatus(AppStatus.CAMERA_READY);

        // Generate Caption via Gemini
        try {
          const caption = await generatePhotoCaption(imageData);
          // Update the photo (whether it's staged or on wall)
          const updateCaption = (pid: string, text: string) => {
             setStagedPhoto(prev => prev && prev.id === pid ? { ...prev, caption: text } : prev);
             setPhotos(prev => prev.map(p => p.id === pid ? { ...p, caption: text } : p));
          };
          updateCaption(newId, caption);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [status, stagedPhoto]);

  const handlePhotoUpdate = (id: string, updates: Partial<PhotoData>) => {
    if (stagedPhoto && stagedPhoto.id === id) {
      setStagedPhoto({ ...stagedPhoto, ...updates });
    }
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handlePhotoDelete = (id: string) => {
    if (stagedPhoto && stagedPhoto.id === id) {
      setStagedPhoto(null);
    } else {
      setPhotos(prev => prev.filter(p => p.id !== id));
    }
  };

  // When staged photo is dropped on the wall
  const handleDragRelease = (id: string, point: { x: number, y: number }) => {
    if (stagedPhoto && stagedPhoto.id === id) {
      const unstaged = { 
        ...stagedPhoto, 
        isStaged: false, 
        position: point 
      };
      setPhotos(prev => [...prev, unstaged]);
      setStagedPhoto(null);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-retro-bg overflow-hidden font-sans selection:bg-yellow-200">
      
      {/* Title */}
      <div className="absolute top-8 left-0 w-full text-center z-10">
        <h1 className="font-handwritten text-5xl text-gray-800 drop-shadow-md opacity-90">
          Bao Retro Camera
        </h1>
        <p className="font-handwritten text-gray-500 mt-2 text-lg">Capture the moment, let AI tell the story.</p>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 right-8 z-10 text-right font-handwritten text-gray-600 max-w-xs">
        <p className="mb-2">1. Click the shutter button.</p>
        <p className="mb-2">2. Wait for the photo to eject.</p>
        <p className="mb-2">3. Drag the photo to the wall.</p>
        <p>4. Hover over text to edit/regenerate.</p>
      </div>

      {/* The Wall (Area for dropped photos) */}
      <div className="absolute inset-0 z-0">
        {photos.map(photo => (
          <PhotoCard 
            key={photo.id}
            photo={photo}
            onUpdate={handlePhotoUpdate}
            onDelete={handlePhotoDelete}
          />
        ))}
      </div>

      {/* The Retro Camera Container */}
      <div 
        className="fixed z-20 select-none"
        style={{ 
          bottom: '64px', 
          left: '64px', 
          width: '450px', 
          height: '450px' 
        }}
      >
        {/* Staged Photo (Ejecting) - Rendered BEHIND camera body visually by z-index, but interacts above */}
        {stagedPhoto && (
          <div className="absolute top-0 left-[50%] -translate-x-1/2 w-0 h-0 z-10">
             {/* Using a wrapper to position the absolute framer component relative to camera center top */}
             <PhotoCard
                photo={stagedPhoto}
                onUpdate={handlePhotoUpdate}
                onDelete={handlePhotoDelete}
                onDragRelease={handleDragRelease}
                className="origin-top"
             />
          </div>
        )}

        {/* Camera Body Image */}
        <img 
          src="https://s.baoyu.io/images/retro-camera.webp" 
          alt="Retro Camera" 
          className="absolute bottom-0 left-0 w-full h-full object-contain z-20 pointer-events-none"
        />

        {/* Viewfinder (Video Feed) */}
        <div 
          className="absolute overflow-hidden bg-black z-30 border-4 border-gray-800 shadow-inner"
          style={{
            bottom: '32%',
            left: '62%',
            transform: 'translateX(-50%)',
            width: '27%',
            height: '27%',
            borderRadius: '50%',
          }}
        >
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform -scale-x-100"
          />
          {status !== AppStatus.CAMERA_READY && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white text-xs text-center">
              {status === AppStatus.ERROR ? "Camera Error" : "Loading..."}
            </div>
          )}
        </div>

        {/* Shutter Button Click Area */}
        <button
          className="absolute z-30 rounded-full active:scale-95 transition-transform focus:outline-none"
          style={{
            bottom: '40%',
            left: '18%',
            width: '11%',
            height: '11%',
            cursor: 'pointer',
            backgroundColor: 'transparent', // Invisible but clickable
            // border: '1px solid red' // Debugging
          }}
          onClick={takePhoto}
          disabled={!!stagedPhoto}
          title="Take Photo"
        />

        {/* Flash Effect Overlay */}
        {status === AppStatus.TAKING_PHOTO && (
          <div className="absolute inset-0 bg-white opacity-50 rounded-3xl z-40 animate-ping pointer-events-none" />
        )}
      </div>

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default App;