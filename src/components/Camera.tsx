import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { cn, calculateMotion, detectPlayerColor, getDefaultColorRanges, captureColorAt } from '../lib/utils';

export function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const [captureMode, setCaptureMode] = useState(false);
  const [capturePoint, setCapturePoint] = useState<{x: number, y: number} | null>(null);
  
  const { 
    phase,
    players,
    difficulty,
    detectionThreshold,
    updatePlayerPosition,
    checkPlayerMovement,
    cameraReady,
    setCameraReady,
    updateCustomColor,
    addPlayer
  } = useGameStore();

  // Initialize camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'environment' // Use back camera on mobile if available
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraReady(false);
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setCameraReady(false);
    };
  }, [setCameraReady]);

  // Player tracking and motion detection
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    let animationFrame: number;
    const colorRanges = getDefaultColorRanges();
    
    // Debug mode - uncomment to see color detection values in console
    // const debugMode = true;
    console.log(`Starting player tracking in ${phase} phase`);

    const trackPlayers = () => {
      try {
        // Draw the current video frame to the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height);

        // Track each player's position by their color - track in ALL phases, not just MOVE/FREEZE
        players.forEach(player => {
          if (!player.active || player.eliminated) return;

          const position = detectPlayerColor(currentFrame, colorRanges, player.color);
          
          /* if (debugMode && position) {
            console.log(`Player ${player.color} position:`, position);
          } */
          
          if (position) {
            // Update positions in ANY phase, including SETUP
            updatePlayerPosition(player.id, position.x, position.y);
          }
        });

        // Store the current frame for next comparison (only during game)
        if (phase === 'MOVE' || phase === 'FREEZE') {
          previousFrameRef.current = currentFrame;
          
          // Only check player movement during FREEZE phase
          if (phase === 'FREEZE') {
            checkPlayerMovement();
          }
        }

        // Continue tracking
        animationFrame = requestAnimationFrame(trackPlayers);
      } catch (error) {
        console.error("Error in player tracking:", error);
        // Recover gracefully by continuing loop
        animationFrame = requestAnimationFrame(trackPlayers);
      }
    };

    trackPlayers();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [
    phase, 
    players, 
    difficulty, 
    detectionThreshold, 
    updatePlayerPosition,
    checkPlayerMovement,
    cameraReady
  ]);
  
  // Handle click on video for color capture
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    // Only process clicks when in capture mode
    if (!captureMode || !videoRef.current || !canvasRef.current) return;
    
    // Prevent event propagation
    e.preventDefault();
    e.stopPropagation();
    
    // Get click coordinates relative to video size
    const rect = videoRef.current.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 480 / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setCapturePoint({ x, y });
    
    // Capture the color at this point
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    
    // Draw current video frame to canvas
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Capture the color
    const [r, g, b] = captureColorAt(imageData, x, y);
    
    // Update the custom color in the store
    updateCustomColor(r, g, b);
    
    // Exit capture mode
    setCaptureMode(false);
    
    // Add a custom player if none exists
    if (!players.some(p => p.color === 'custom')) {
      console.log("Adding custom player for color tracking");
      addPlayer('custom' as any);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full rounded-lg shadow-xl",
          captureMode && "cursor-crosshair"
        )}
        onClick={handleVideoClick}
      />
      <canvas
        ref={canvasRef}
        className="hidden"
        width={640}
        height={480}
      />
      
      {/* Color capture mode indicator */}
      {captureMode && (
        <div className="absolute top-0 left-0 right-0 pointer-events-none bg-black/60 text-white p-2 text-center">
          Click anywhere on the video to capture that color for tracking
        </div>
      )}
      
      {/* Capture point indicator */}
      {capturePoint && (
        <div 
          className="absolute w-8 h-8 rounded-full border-2 border-white -ml-4 -mt-4 pointer-events-none"
          style={{
            left: `${(capturePoint.x / 640) * 100}%`,
            top: `${(capturePoint.y / 480) * 100}%`
          }}
        />
      )}
      
      {/* Game state overlays */}
      {phase === 'FREEZE' && (
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none border-4 border-red-500 rounded-lg animate-pulse" />
      )}
      
      {phase === 'MOVE' && (
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none border-4 border-green-500 rounded-lg" />
      )}
      
      {!cameraReady && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-xl font-bold">Camera access required</p>
            <p className="mt-2">Please allow camera access to play</p>
          </div>
        </div>
      )}
      
      {/* Player indicators - show colored dots for each active player */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
        {players.map(player => {
          if (!player.active) return null;
          
          const style = {
            left: `${(player.position.x / 640) * 100}%`,
            top: `${(player.position.y / 480) * 100}%`,
            backgroundColor: player.color === 'custom' ? 'purple' : player.color
          };
          
          return (
            <div 
              key={player.id}
              className="absolute w-4 h-4 rounded-full -ml-2 -mt-2"
              style={style}
            />
          );
        })}
      </div>
      
      {/* Color capture button */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={(e) => {
            // Prevent event propagation
            e.preventDefault();
            e.stopPropagation();
            setCaptureMode(!captureMode);
          }}
          className={cn(
            "px-3 py-2 rounded-full",
            captureMode ? "bg-green-500" : "bg-purple-500",
            "text-white font-bold shadow-lg z-50"
          )}
        >
          {captureMode ? "Cancel Capture" : "Capture Color"}
        </button>
      </div>
    </div>
  );
}