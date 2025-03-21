import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { cn } from '../lib/utils';
import { generateRandomNumber } from '../lib/utils';

export function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousFrameRef = useRef<ImageData | null>(null);
  const [captureMode, setCaptureMode] = useState(false);
  // We don't need the capturePoint state anymore since we're using a fixed center target
  const [scanningPlayers, setScanningPlayers] = useState(false);
  
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
  }, [setCameraReady]); // Only depends on setCameraReady

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
          
          // Find the position of this color in the frame (with player ID for tracking)
          const position = findColorPosition(currentFrame, playerColor, player.id);
          
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
  
  // Track previous positions for position smoothing
  const prevPositions = useRef<Record<string, {x: number, y: number}>>({});
  
  // Find a specific color in the frame
  const findColorPosition = (
    imageData: ImageData, 
    targetColor: [number, number, number],
    playerId: string
  ): { x: number, y: number } | null => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Store multiple color matches for a smarter detection algorithm
    const colorMatches: { x: number, y: number, weight: number }[] = [];
    
    // Extract target color components
    const [targetR, targetG, targetB] = targetColor;
    
    // Color threshold - how close a pixel needs to be to match (stricter now)
    const colorThreshold = 50; // Reduced from 60 for stricter matching
    
    // Sample every Nth pixel for better performance
    const sampleStep = 6;
    
    // Check if the target color is bright
    const isTargetColorBright = (targetR + targetG + targetB) > 350;
    
    // Calculate target properties
    const isTargetWhite = targetR > 220 && targetG > 220 && targetB > 220;
    const isTargetGreen = targetG > 150 && targetG > (targetR * 1.4) && targetG > (targetB * 1.4);
    
    // Get previous position for this player (if exists)
    const prevPosition = prevPositions.current[playerId];
    
    // Search radius - if we have a previous position, focus search around it first
    const searchRadius = 100; // pixels around previous position
    let foundInPrevRegion = false;
    
    // If we have a previous position, try looking there first with a tighter search
    if (prevPosition) {
      const searchArea = {
        minX: Math.max(0, prevPosition.x - searchRadius),
        maxX: Math.min(width - 1, prevPosition.x + searchRadius),
        minY: Math.max(0, prevPosition.y - searchRadius),
        maxY: Math.min(height - 1, prevPosition.y + searchRadius)
      };
      
      // Search just the region around previous position first
      for (let y = searchArea.minY; y < searchArea.maxY; y += sampleStep) {
        for (let x = searchArea.minX; x < searchArea.maxX; x += sampleStep) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Skip very dark pixels (likely background)
          const brightness = r + g + b;
          if (brightness < 80 && !isTargetColorBright) continue;
          
          // Skip white/light colors if we're not looking for white
          if (!isTargetWhite && r > 220 && g > 220 && b > 220) continue;
          
          // Skip green colors if we're not looking for green
          if (!isTargetGreen && g > 150 && g > (r * 1.4) && g > (b * 1.4)) continue;
          
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
            
            // Prioritize matches that are close to previous position
            const proximityBonus = 1.5; // Increase weight of matches near previous position
            
            // Store this as a potential color match with proximity bonus
            colorMatches.push({ 
              x, 
              y, 
              weight: weight * proximityBonus
            });
            foundInPrevRegion = true;
          }
        }
      }
    }
    
    // Only search the full frame if we didn't find enough matches in the previous region
    if (!foundInPrevRegion) {
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
          
          // Skip white/light colors if we're not looking for white
          if (!isTargetWhite && r > 220 && g > 220 && b > 220) continue;
          
          // Skip green colors if we're not looking for green
          if (!isTargetGreen && g > 150 && g > (r * 1.4) && g > (b * 1.4)) continue;
          
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
            // Guard against division by zero
            if (totalWeight > 0) {
              cluster.x = (cluster.x * cluster.totalWeight + match.x * match.weight) / totalWeight;
              cluster.y = (cluster.y * cluster.totalWeight + match.y * match.weight) / totalWeight;
              cluster.count++;
              cluster.totalWeight = totalWeight;
            }
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
        
        // Get the best cluster center
        const bestCluster = {
          x: clusters[0].x,
          y: clusters[0].y
        };
        
        // Apply position smoothing if we have a previous position
        if (prevPosition) {
          // Calculate how much to smooth movement (0-1)
          // Lower values = smoother but slower response
          // Higher values = faster response but more jitter
          const smoothingFactor = 0.25; 
          
          // Smooth the position by blending previous and current
          const smoothedPosition = {
            x: prevPosition.x + (bestCluster.x - prevPosition.x) * smoothingFactor,
            y: prevPosition.y + (bestCluster.y - prevPosition.y) * smoothingFactor
          };
          
          // Check for unreasonable jumps (more than 150px in one frame)
          const jumpDistance = Math.sqrt(
            Math.pow(smoothedPosition.x - prevPosition.x, 2) + 
            Math.pow(smoothedPosition.y - prevPosition.y, 2)
          );
          
          if (jumpDistance > 150) {
            // Ignore this detection - it's likely wrong
            // Just return the previous position with very slight movement
            // This prevents the tracking from jumping around
            const tinyStep = 0.05;
            prevPositions.current[playerId] = {
              x: prevPosition.x + (bestCluster.x - prevPosition.x) * tinyStep,
              y: prevPosition.y + (bestCluster.y - prevPosition.y) * tinyStep
            };
            return prevPositions.current[playerId];
          }
          
          // Save the smoothed position for next frame
          prevPositions.current[playerId] = smoothedPosition;
          return smoothedPosition;
        }
        
        // For first detection, just use the cluster center
        prevPositions.current[playerId] = bestCluster;
        return bestCluster;
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
      
      // Guard against division by zero
      if (totalWeight > 0) {
        const averagePosition = {
          x: totalX / totalWeight,
          y: totalY / totalWeight
        };
        
        // Apply position smoothing if we have a previous position
        if (prevPosition) {
          // Stronger smoothing for fallback method
          const smoothingFactor = 0.2; 
          
          // Smooth the position by blending previous and current
          const smoothedPosition = {
            x: prevPosition.x + (averagePosition.x - prevPosition.x) * smoothingFactor,
            y: prevPosition.y + (averagePosition.y - prevPosition.y) * smoothingFactor
          };
          
          // Check for unreasonable jumps (more than 100px in one frame)
          const jumpDistance = Math.sqrt(
            Math.pow(smoothedPosition.x - prevPosition.x, 2) + 
            Math.pow(smoothedPosition.y - prevPosition.y, 2)
          );
          
          if (jumpDistance > 100) {
            // Ignore this detection - it's likely wrong
            return prevPosition;
          }
          
          // Save the smoothed position for next frame
          prevPositions.current[playerId] = smoothedPosition;
          return smoothedPosition;
        }
        
        // First detection with fallback method
        prevPositions.current[playerId] = averagePosition;
        return averagePosition;
      }
      
      // If we had a previous position but no good detection, return previous
      if (prevPosition) {
        return prevPosition;
      }
      
      return null;
    }
    
    // If we had a previous position but no matches at all, return previous
    if (prevPosition) {
      return prevPosition;
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
    
    // Use center point as target for color capture
    const x = 320; // center of 640
    const y = 240; // center of 480
    
    console.log("Using center point for color capture:", x, y);
    
    // Capture the color at this point
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    
    let imageData;
    
    try {
      // Force canvas and video dimensions to be correct
      canvas.width = 640;
      canvas.height = 480;
      
      console.log("Canvas dimensions:", canvas.width, canvas.height);
      console.log("Video ready state:", videoRef.current.readyState);
      
      // Draw current video frame to canvas
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      console.log("Video frame drawn to canvas");
      
      // Create a fallback image data if reading from canvas fails
      const fallbackData = new Uint8ClampedArray(640 * 480 * 4);
      // Fill with magenta for visibility - this will be used if getImageData fails
      for (let i = 0; i < fallbackData.length; i += 4) {
        fallbackData[i] = 255;     // R
        fallbackData[i + 1] = 0;   // G
        fallbackData[i + 2] = 255; // B
        fallbackData[i + 3] = 255; // A
      }
      
      try {
        // Try to get image data
        imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log("Successfully got image data:", 
                   imageData.width, "x", imageData.height, 
                   "data length:", imageData.data.length);
      } catch (imgError) {
        console.error("Error getting image data:", imgError);
        // Create a fallback image data
        imageData = new ImageData(fallbackData, 640, 480);
        console.log("Using fallback image data");
      }
    } catch (error) {
      console.error("Error with canvas operations:", error);
      // Create an artificial image data with a default color (magenta)
      const fallbackData = new Uint8ClampedArray(640 * 480 * 4);
      for (let i = 0; i < fallbackData.length; i += 4) {
        fallbackData[i] = 255;     // R
        fallbackData[i + 1] = 0;   // G
        fallbackData[i + 2] = 255; // B
        fallbackData[i + 3] = 255; // A
      }
      imageData = new ImageData(fallbackData, 640, 480);
      console.log("Using artificial image data after error");
    }
    
    // Capture the color
    const capturedColor = captureColorAt(imageData, x, y);
    
    // Exit capture mode
    setCaptureMode(false);
    
    // Show a color picker for the user to select which player to update
    if (players.length > 0) {
      // Force using a default color if we had issues
      const colorToUse: [number, number, number] = [
        capturedColor[0] || 200,
        capturedColor[1] || 50,
        capturedColor[2] || 50
      ];
      
      // Log for debugging
      console.log(`Using color: RGB(${colorToUse.join(', ')})`);
      
      const selectedPlayer = window.prompt(`Found color: RGB(${colorToUse.join(', ')})\n\nEnter player ID to update:`);
      
      if (selectedPlayer && players.some(p => p.id === selectedPlayer)) {
        console.log(`Updating player ${selectedPlayer} with color: RGB(${colorToUse.join(', ')})`);
        updatePlayerColor(
          selectedPlayer,
          colorToUse[0],
          colorToUse[1],
          colorToUse[2]
        );
      }
    }
  };
  
  // Helper to capture the average color around a point
  // Scan for outstanding colors in the video frame and register players
  const scanOutstandingColors = () => {
    if (!videoRef.current || !canvasRef.current || scanningPlayers) return;
    
    setScanningPlayers(true);
    console.log("Starting player scan...");
    
    // Get canvas and context
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      setScanningPlayers(false);
      return;
    }
    
    // Force canvas dimensions
    canvas.width = 640;
    canvas.height = 480;
    
    // Show a message to the user to let them know scanning is in progress
    window.alert("Please hold colorful objects in frame. Scanning will begin in 2 seconds...");
    
    // Add a delay to give users time to position colored objects
    setTimeout(() => {
      try {
        // Draw current video frame to canvas
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        console.log("Video frame drawn to canvas for scanning");
        
        // Get image data
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan the frame for distinct colors
        const detectedColors = findDistinctColors(imageData);
        console.log(`Found ${detectedColors.length} distinct colors`);
        
        if (detectedColors.length === 0) {
          window.alert("No distinct colors detected. Try with more colorful objects in frame. Avoid white, gray, or very light colors.");
          setScanningPlayers(false);
          return;
        }
        
        // Register each detected color as a player with a random 3-digit ID
        detectedColors.forEach((color) => {
          // Generate a random 3-digit ID
          const playerId = generateRandomNumber(100, 999).toString();
          
          // Register this player with the detected color
          console.log(`Adding player ${playerId} with color RGB(${color.join(', ')})`);
          // Use the store directly to ensure the functions are available
          const gameStore = useGameStore.getState();
          gameStore.addPlayer(playerId);
          gameStore.updatePlayerColor(playerId, color[0], color[1], color[2]);
        });
        
        // Alert user of success with color details
        const colorDetails = detectedColors.map(color => 
          `RGB(${color[0]}, ${color[1]}, ${color[2]})`
        ).join(', ');
        
        window.alert(`Successfully registered ${detectedColors.length} players!\n\nDetected colors: ${colorDetails}\n\nMake sure these colors match the objects you want to track.`);
      } catch (error) {
        console.error("Error during player scanning:", error);
        window.alert("Error during player scanning. Please try again.");
      } finally {
        setScanningPlayers(false);
      }
    }, 2000); // 2 second delay before scanning
  };
  
  // Find distinct colors in the image (different from background)
  const findDistinctColors = (imageData: ImageData, maxColors: number = 4): [number, number, number][] => {
    const width = imageData.width;
    const height = imageData.height;
    
    // Sample points across the frame (6x4 grid - focusing more on the lower part of the frame)
    // This helps avoid ceiling detection and focuses more on where players would be
    const samplePoints: {x: number, y: number}[] = [];
    for (let y = 1; y < 4; y++) { // Start from row 1 (not 0) to avoid top of frame
      for (let x = 0; x < 6; x++) {
        samplePoints.push({
          x: Math.floor(width * (x + 0.5) / 6),
          y: Math.floor(height * (y + 1.0) / 4) // Weight toward lower part of frame
        });
      }
    }
    
    // Get color samples from these points
    const colorSamples: [number, number, number][] = [];
    
    // For each sample point, capture the color with a large sample area
    samplePoints.forEach(point => {
      const color = captureColorAt(imageData, point.x, point.y, 15);
      
      // Calculate color saturation and brightness
      const max = Math.max(color[0], color[1], color[2]);
      const min = Math.min(color[0], color[1], color[2]);
      const brightness = max / 255; // 0-1 scale
      const saturation = max === 0 ? 0 : (max - min) / max; // 0-1 scale
      
      // Skip colors that are:
      // 1. Too dark (all values < 40)
      // 2. Too bright AND low saturation (white/gray ceiling/walls)
      // 3. Too similar in all channels (grays)
      // 4. Too white (R, G, B all high)
      // 5. Too green (G much higher than R and B)
      const isTooDark = color[0] + color[1] + color[2] < 120;
      const isTooWhite = brightness > 0.8 && saturation < 0.15;
      const isGray = Math.abs(color[0] - color[1]) < 20 && 
                    Math.abs(color[1] - color[2]) < 20 && 
                    Math.abs(color[0] - color[2]) < 20;
      const isTooGreen = color[1] > 150 && color[1] > (color[0] * 1.4) && color[1] > (color[2] * 1.4);
      const isTooWhiteGeneric = color[0] > 220 && color[1] > 220 && color[2] > 220;
      
      if (!isTooDark && !isTooWhite && !isGray && !isTooGreen && !isTooWhiteGeneric) {
        colorSamples.push(color);
        console.log(`Sample at (${point.x},${point.y}): RGB(${color.join(',')}), sat: ${saturation.toFixed(2)}, bright: ${brightness.toFixed(2)}`);
      }
    });
    
    // Find distinct colors (merge similar ones)
    const distinctColors: [number, number, number][] = [];
    const colorThreshold = 60; // How different colors need to be to count as distinct
    
    // Sort by saturation (most saturated first)
    colorSamples.sort((a, b) => {
      const satA = Math.max(...a) - Math.min(...a);
      const satB = Math.max(...b) - Math.min(...b);
      return satB - satA;
    });
    
    colorSamples.forEach(color => {
      // Skip this sample if we already have enough colors
      if (distinctColors.length >= maxColors) return;
      
      // Check if this color is sufficiently different from existing distinct colors
      let isDistinct = true;
      
      for (const existingColor of distinctColors) {
        const diffR = color[0] - existingColor[0];
        const diffG = color[1] - existingColor[1];
        const diffB = color[2] - existingColor[2];
        
        const colorDistance = Math.sqrt(diffR*diffR + diffG*diffG + diffB*diffB);
        
        if (colorDistance < colorThreshold) {
          isDistinct = false;
          break;
        }
      }
      
      // Add to distinct colors if it passed the test
      if (isDistinct) {
        distinctColors.push(color);
        console.log(`Found distinct color: RGB(${color.join(',')})`);
      }
    });
    
    return distinctColors;
  };
  
  // Helper to capture the average color around a point
  const captureColorAt = (
    imageData: ImageData,
    x: number,
    y: number,
    sampleSize: number = 20 // Increased sample size for better detection
  ): [number, number, number] => {
    try {
      // Validate all input parameters
      console.log(`Capturing color at x=${x}, y=${y}, sampleSize=${sampleSize}`);
      console.log(`Image dimensions: ${imageData.width}x${imageData.height}`);
      
      if (!imageData || !imageData.data) {
        console.error("Image data is null or undefined");
        return [200, 50, 50]; // Default red color
      }
      
      const width = imageData.width;
      const height = imageData.height;
      const data = imageData.data;
      
      // Ensure coordinates are within bounds and valid
      if (isNaN(x) || isNaN(y) || width <= 0 || height <= 0) {
        console.error(`Invalid capture parameters: x=${x}, y=${y}, width=${width}, height=${height}`);
        return [200, 50, 50]; // Default red color
      }
      
      // Ensure we're within the valid range for the image
      x = Math.max(sampleSize, Math.min(width - sampleSize - 1, x));
      y = Math.max(sampleSize, Math.min(height - sampleSize - 1, y));
      
      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let samplesCount = 0;
      
      // Draw target indicator (for debugging)
      console.log(`Sampling circle with radius ${sampleSize} at (${x}, ${y})`);
      
      // Sample pixels in a circular area (more natural than square)
      for (let sy = Math.floor(y - sampleSize); sy < Math.floor(y + sampleSize); sy++) {
        for (let sx = Math.floor(x - sampleSize); sx < Math.floor(x + sampleSize); sx++) {
          // Calculate distance from center
          const distance = Math.sqrt(Math.pow(sx - x, 2) + Math.pow(sy - y, 2));
          
          // Only include pixels within the circle radius
          if (distance <= sampleSize && sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const index = (sy * width + sx) * 4;
            
            // Make sure we're not reading outside the bounds of the data array
            if (index >= 0 && index + 2 < data.length) {
              // Weight by distance from center (closer pixels count more)
              const weight = 1.0 - (distance / sampleSize);
              
              totalR += data[index] * weight;
              totalG += data[index + 1] * weight;
              totalB += data[index + 2] * weight;
              samplesCount += weight;
            }
          }
        }
      }
      
      console.log(`Collected ${samplesCount} samples from a ${sampleSize*2}x${sampleSize*2} area`);
      
      // Calculate averages with guard against division by zero
      if (samplesCount === 0) {
        console.error("No samples collected for color capture");
        return [200, 50, 50]; // Default red color
      }
      
      const avgR = Math.round(totalR / samplesCount);
      const avgG = Math.round(totalG / samplesCount);
      const avgB = Math.round(totalB / samplesCount);
      
      console.log(`Captured color: R=${avgR}, G=${avgG}, B=${avgB}`);
      
      return [avgR, avgG, avgB];
    } catch (error) {
      console.error("Error in captureColorAt:", error);
      return [200, 50, 50]; // Default red color if anything fails
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
      
      {/* Scanning indicator - show when scanning is in progress */}
      {scanningPlayers && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-white text-xl font-bold mb-4">Scanning for Players...</div>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white mt-4">Please keep colorful objects in frame</div>
          <div className="text-white text-sm mt-2">Avoid white, gray, or light colors</div>
        </div>
      )}
      
      {/* Capture point indicator */}
      {captureMode && (
        <div className="absolute pointer-events-none flex items-center justify-center top-0 left-0 right-0 bottom-0">
          <div className="relative">
            {/* Target circles */}
            <div className="w-64 h-64 rounded-full border-2 border-white opacity-30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="w-32 h-32 rounded-full border-2 border-white opacity-60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="w-16 h-16 rounded-full border-2 border-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="w-4 h-4 rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            
            {/* Crosshair lines */}
            <div className="w-64 h-0.5 bg-white opacity-70 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="w-0.5 h-64 bg-white opacity-70 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            
            {/* Guidance text */}
            <div className="absolute -bottom-20 text-center text-white bg-black/50 p-2 rounded-lg w-64 left-1/2 -translate-x-1/2">
              Position colored object in target
            </div>
          </div>
        </div>
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
      
      {/* Player controls - only show in SETUP phase */}
      {phase === 'SETUP' && (
        <>
          <div className="absolute bottom-20 left-4 right-4 bg-black/70 p-3 rounded-lg text-white text-sm">
            <p className="font-bold mb-1">Color Detection Tips:</p>
            <ul className="list-disc pl-5">
              <li>Use vibrant, saturated colors (red, blue, purple, orange)</li>
              <li>Avoid white, gray, or light colors</li>
              <li>Avoid green (similar to background)</li>
              <li>Keep good lighting on colored objects</li>
            </ul>
          </div>
        
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={(e) => {
                // Prevent event propagation
                e.preventDefault();
                e.stopPropagation();
                // Call our new scanOutstandingColors method
                scanOutstandingColors();
              }}
              className={cn(
                "px-3 py-2 rounded-full",
                "bg-blue-500",
                "text-white font-bold shadow-lg z-50"
              )}
            >
              Scan Players
            </button>
            
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
        </>
      )}
    </div>
  );
}