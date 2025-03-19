import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { cn, calculateMotion } from '../lib/utils';

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
    playerColors,
    updatePlayerPosition,
    checkPlayerMovement,
    cameraReady,
    setCameraReady,
    updatePlayerColor
  } = useGameStore();

  // Initialize camera with better persistence
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        // Check if we already have a stream active
        if (videoRef.current?.srcObject) {
          console.log("Camera already initialized, reusing stream");
          setCameraReady(true);
          return;
        }

        console.log("Setting up camera...");
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'environment' // Use back camera on mobile if available
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            console.error("Error playing video:", err);
          });
          
          videoRef.current.onloadedmetadata = () => {
            console.log("Camera metadata loaded");
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraReady(false);
      }
    }

    setupCamera();

    // Only clean up on component unmount, not during phase transitions
    return () => {
      if (stream) {
        console.log("Stopping camera stream on component unmount");
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array ensures this only runs once on mount

  // Player tracking and motion detection
  useEffect(() => {
    // Only run tracking if camera is ready
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      console.log("Camera or canvas not ready, can't start tracking");
      return;
    }

    console.log(`Starting player tracking in ${phase} phase with ${players.length} players`);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    let animationFrame: number;
    let frameCount = 0;
    
    const trackPlayers = () => {
      try {
        frameCount++;
        
        // Skip some frames for performance (process every 2 frames)
        if (frameCount % 2 !== 0) {
          animationFrame = requestAnimationFrame(trackPlayers);
          return;
        }
        
        // Draw the current video frame to the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height);

        // Track each player by their custom colors
        for (const player of players) {
          if (!player.active || player.eliminated) continue;
          
          // Get this player's color
          const playerColor = playerColors[player.id];
          if (!playerColor) continue;
          
          // Find the position of this color in the frame
          const position = findColorPosition(currentFrame, playerColor);
          
          if (position) {
            // Update player positions in the store
            updatePlayerPosition(player.id, position.x, position.y);
            
            // Occasionally log position updates
            if (frameCount % 60 === 0) {
              console.log(`Player ${player.id} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
            }
          }
        }

        // Store the current frame for next comparison (for motion detection)
        if (phase === 'FREEZE') {
          // Only check for movement during FREEZE phase
          previousFrameRef.current = currentFrame;
          checkPlayerMovement();
        }

        // Continue tracking loop
        animationFrame = requestAnimationFrame(trackPlayers);
      } catch (error) {
        console.error("Error in player tracking:", error);
        // Recover from errors by continuing the loop
        animationFrame = requestAnimationFrame(trackPlayers);
      }
    };

    // Start the tracking loop
    trackPlayers();
    console.log("Color tracking started");

    // Clean up the animation frame on unmount or phase change
    return () => {
      cancelAnimationFrame(animationFrame);
      console.log("Color tracking stopped");
    };
  }, [
    players,
    phase,
    cameraReady,
    updatePlayerPosition,
    checkPlayerMovement,
    difficulty, 
    detectionThreshold,
    playerColors
  ]);
  
  // Find a specific color in the frame
  const findColorPosition = (
    imageData: ImageData, 
    targetColor: [number, number, number]
  ): { x: number, y: number } | null => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Store multiple color matches for a smarter detection algorithm
    const colorMatches: { x: number, y: number, weight: number }[] = [];
    
    // Extract target color components
    const [targetR, targetG, targetB] = targetColor;
    
    // Color threshold - how close a pixel needs to be to match
    const colorThreshold = 60;
    
    // Sample every Nth pixel for better performance
    const sampleStep = 6;
    
    // Check if the target color is bright
    const isTargetColorBright = (targetR + targetG + targetB) > 350;
    
    // Scan the entire frame for matching colors
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Skip very dark pixels (likely background)
        const brightness = r + g + b;
        if (brightness < 80 && !isTargetColorBright) continue;
        
        // Calculate color difference using Euclidean distance
        const diffR = r - targetR;
        const diffG = g - targetG;
        const diffB = b - targetB;
        
        // Use different channel weights to better match human perception
        const distance = Math.sqrt(
          (diffR * diffR * 0.3) + 
          (diffG * diffG * 0.4) + 
          (diffB * diffB * 0.3)
        );
        
        // Calculate match quality (0-1)
        if (distance < colorThreshold) {
          // Use a weight based on how close the match is
          const weight = 1.0 - (distance / colorThreshold);
          
          // Store this as a potential color match
          colorMatches.push({ x, y, weight });
        }
      }
    }
    
    // Minimum pixels required for a good detection
    const minPixels = 5;
    
    // If we have enough matches, perform smart sensing
    if (colorMatches.length >= minPixels) {
      // Sort matches by weight (closest color match first)
      colorMatches.sort((a, b) => b.weight - a.weight);
      
      // Find potential clusters by grouping nearby matches
      const clusters: { x: number, y: number, count: number, totalWeight: number }[] = [];
      
      // Process each match to find or create clusters
      colorMatches.forEach(match => {
        // Look for an existing cluster this match might belong to
        let foundCluster = false;
        
        for (const cluster of clusters) {
          // Calculate distance to cluster center
          const dist = Math.sqrt(
            Math.pow(match.x - cluster.x, 2) + 
            Math.pow(match.y - cluster.y, 2)
          );
          
          // If match is close to this cluster, add it
          if (dist < 50) { // 50px radius for clustering
            // Update cluster center as a weighted average
            const totalWeight = cluster.totalWeight + match.weight;
            cluster.x = (cluster.x * cluster.totalWeight + match.x * match.weight) / totalWeight;
            cluster.y = (cluster.y * cluster.totalWeight + match.y * match.weight) / totalWeight;
            cluster.count++;
            cluster.totalWeight = totalWeight;
            foundCluster = true;
            break;
          }
        }
        
        // If no matching cluster was found, start a new one
        if (!foundCluster) {
          clusters.push({
            x: match.x,
            y: match.y,
            count: 1,
            totalWeight: match.weight
          });
        }
      });
      
      // Find the best cluster (most matches with highest weight)
      if (clusters.length > 0) {
        // Sort clusters by a combination of count and total weight
        clusters.sort((a, b) => 
          (b.count * b.totalWeight) - (a.count * a.totalWeight)
        );
        
        // Return the center of the best cluster
        return {
          x: clusters[0].x,
          y: clusters[0].y
        };
      }
    }
    
    // Fallback to the old weighted average method if clustering didn't produce results
    if (colorMatches.length >= minPixels) {
      let totalX = 0;
      let totalY = 0;
      let totalWeight = 0;
      
      colorMatches.forEach(match => {
        totalX += match.x * match.weight;
        totalY += match.y * match.weight;
        totalWeight += match.weight;
      });
      
      return {
        x: totalX / totalWeight,
        y: totalY / totalWeight
      };
    }
    
    return null;
  };
  
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
    const capturedColor = captureColorAt(imageData, x, y);
    
    // Exit capture mode
    setCaptureMode(false);
    
    // Show a color picker for the user to select which player to update
    if (players.length > 0) {
      const selectedPlayer = window.prompt(`Found color: RGB(${capturedColor.join(', ')})\n\nEnter player ID to update:`);
      
      if (selectedPlayer && players.some(p => p.id === selectedPlayer)) {
        updatePlayerColor(
          selectedPlayer,
          capturedColor[0],
          capturedColor[1],
          capturedColor[2]
        );
      }
    }
  };
  
  // Helper to capture the average color around a point
  const captureColorAt = (
    imageData: ImageData,
    x: number,
    y: number,
    sampleSize: number = 10
  ): [number, number, number] => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Ensure coordinates are within bounds
    x = Math.max(sampleSize, Math.min(width - sampleSize, x));
    y = Math.max(sampleSize, Math.min(height - sampleSize, y));
    
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let samplesCount = 0;
    
    // Sample pixels in a square around the point
    for (let sy = y - sampleSize; sy < y + sampleSize; sy++) {
      for (let sx = x - sampleSize; sx < x + sampleSize; sx++) {
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          const index = (sy * width + sx) * 4;
          totalR += data[index];
          totalG += data[index + 1];
          totalB += data[index + 2];
          samplesCount++;
        }
      }
    }
    
    // Calculate averages
    const avgR = Math.round(totalR / samplesCount);
    const avgG = Math.round(totalG / samplesCount);
    const avgB = Math.round(totalB / samplesCount);
    
    console.log(`Captured color: R=${avgR}, G=${avgG}, B=${avgB}`);
    
    return [avgR, avgG, avgB];
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
          
          const playerColor = playerColors[player.id] || [0, 0, 0];
          
          const style = {
            left: `${(player.position.x / 640) * 100}%`,
            top: `${(player.position.y / 480) * 100}%`,
            backgroundColor: `rgb(${playerColor[0]}, ${playerColor[1]}, ${playerColor[2]})`
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