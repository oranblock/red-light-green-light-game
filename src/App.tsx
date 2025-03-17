import React, { useState, useEffect, useRef } from 'react';
import { captureColorAt } from './lib/utils';

// Settings interface
interface GameSettings {
  enableCamera: boolean;
  enableColorTracking: boolean;
  debugMode: boolean;
  phaseDuration: number;
  eliminationEnabled: boolean;
  movementThreshold: number;
  preferredCamera: 'environment' | 'user' | 'any';
}

// Debug logs
interface DebugLog {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error';
}

// Player type
interface Player {
  color: string;
  position: { x: number, y: number };
  lastPosition: { x: number, y: number };
  score: number;
  eliminated: boolean;
}

function App() {
  // Game state
  const [phase, setPhase] = useState<'MENU' | 'SETUP' | 'MOVE' | 'FREEZE' | 'GAME_OVER'>('MENU');
  const [timer, setTimer] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [customColor, setCustomColor] = useState<[number, number, number]>([150, 150, 150]);
  const [captureMode, setCaptureMode] = useState(false);
  const [capturePoint, setCapturePoint] = useState<{x: number, y: number} | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  
  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    enableCamera: false,
    enableColorTracking: false,
    debugMode: false,
    phaseDuration: 5,
    eliminationEnabled: false,
    movementThreshold: 30,
    preferredCamera: 'environment' // Default to back camera
  });
  
  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Add a debug log
  const addLog = (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    if (settings.debugMode) {
      setDebugLogs(prev => [
        { timestamp: Date.now(), message, type },
        ...prev.slice(0, 99) // Keep only last 100 logs
      ]);
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
  
  // Start the game
  const startGame = () => {
    if (players.length === 0) {
      // Add a default player if none
      addPlayer('red');
    }
    
    // Make sure camera and color tracking remain enabled if they were set
    const currentSettings = {...settings};
    
    setGameActive(true);
    setPhase('MOVE');
    setTimer(settings.phaseDuration);
    
    // Re-initialize camera if needed
    if (currentSettings.enableCamera && !cameraReady) {
      console.log("Re-initializing camera for game start");
      setTimeout(() => {
        initCamera();
      }, 100);
    }
    
    addLog(`Game started in MOVE phase with camera=${currentSettings.enableCamera}, tracking=${currentSettings.enableColorTracking}`);
  };
  
  // Reset the game
  const resetGame = () => {
    setGameActive(false);
    setPhase('SETUP');
    setTimer(settings.phaseDuration);
    
    // Reset players but keep their colors
    setPlayers(prev => prev.map(p => ({
      ...p,
      position: { x: 0, y: 0 },
      lastPosition: { x: 0, y: 0 },
      score: 0,
      eliminated: false
    })));
    
    addLog("Game reset");
  };
  
  // Go to main menu
  const goToMenu = () => {
    setGameActive(false);
    setPhase('MENU');
    
    // Preserve camera settings
    if (settings.enableCamera && !cameraReady) {
      setTimeout(() => {
        initCamera();
      }, 100);
    }
    
    addLog("Returned to main menu");
  };
  
  // Add a player
  const addPlayer = (color: string) => {
    // Check if this color already exists
    if (!players.some(p => p.color === color)) {
      setPlayers([...players, {
        color,
        position: { x: 0, y: 0 },
        lastPosition: { x: 0, y: 0 },
        score: 0,
        eliminated: false
      }]);
      addLog(`Added ${color} player`);
    }
  };
  
  // Remove a player
  const removePlayer = (color: string) => {
    setPlayers(prev => prev.filter(p => p.color !== color));
    addLog(`Removed ${color} player`);
  };
  
  // Initialize camera
  const initCamera = async () => {
    if (!settings.enableCamera) {
      setCameraReady(false);
      console.log("Camera disabled in settings");
      return;
    }
    
    if (!videoRef.current) {
      console.error("No video element available");
      return;
    }
    
    // Clear any existing stream
    if (videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    console.log("Requesting camera access...");
    
    try {
      // First check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }
      
      // Configure camera based on settings
      let cameraConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };
      
      // Set facing mode based on settings
      if (settings.preferredCamera === 'environment') {
        console.log("Requesting back camera...");
        cameraConstraints.facingMode = { ideal: "environment" };
      } else if (settings.preferredCamera === 'user') {
        console.log("Requesting front camera...");
        cameraConstraints.facingMode = { ideal: "user" };
      } else {
        console.log("Requesting any camera...");
      }
      
      // Try to get the preferred camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: cameraConstraints,
        audio: false
      }).catch(async (err) => {
        console.log(`Error getting ${settings.preferredCamera} camera:`, err);
        console.log("Trying fallback to any available camera...");
        
        // Fallback to any available camera
        return await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false
        });
      });
      
      console.log("Camera access granted");
      
      // Update the video element
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        setCameraReady(true);
        addLog("Camera initialized successfully");
        console.log("Video metadata loaded");
      };
      
      // Set up error handler
      videoRef.current.onerror = (e) => {
        console.error("Video element error:", e);
        addLog(`Video element error: ${e}`, 'error');
      };
      
      // Extra check to make sure camera is working
      setTimeout(() => {
        if (!cameraReady && videoRef.current) {
          console.log("Camera not ready after timeout, trying to play video...");
          videoRef.current.play().catch(err => {
            console.error("Error playing video:", err);
          });
        }
      }, 1000);
      
    } catch (err) {
      console.error("Error accessing camera:", err);
      addLog(`Error accessing camera: ${err}`, 'error');
      setCameraReady(false);
      
      // Show a browser permission prompt for the user
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert("Please allow camera access to use this feature. You might need to update your browser settings.");
      }
    }
  };
  
  // Handle camera settings change
  useEffect(() => {
    console.log("Camera setting changed:", settings.enableCamera);
    
    if (settings.enableCamera) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        console.log("Initializing camera...");
        initCamera();
      }, 500);
    } else {
      // Stop camera if it was running
      if (videoRef.current && videoRef.current.srcObject) {
        console.log("Stopping camera...");
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setCameraReady(false);
    }
  }, [settings.enableCamera]);
  
  // Also initialize camera when entering setup phase if enabled
  useEffect(() => {
    if (phase === 'SETUP' && settings.enableCamera && !cameraReady) {
      console.log("Setup phase - initializing camera");
      initCamera();
    }
  }, [phase, settings.enableCamera, cameraReady]);
  
  // Timer effect
  useEffect(() => {
    if (!gameActive || phase === 'SETUP' || phase === 'MENU' || phase === 'GAME_OVER') return;
    
    const interval = setInterval(() => {
      if (timer > 0) {
        setTimer(timer - 1);
      } else {
        // Toggle phase
        const newPhase = phase === 'MOVE' ? 'FREEZE' : 'MOVE';
        addLog(`Switching to ${newPhase} phase`);
        
        // Make sure we re-initialize camera and tracking if they're enabled
        if (settings.enableCamera && !cameraReady) {
          console.log("Re-initializing camera on phase change");
          initCamera();
        }
        
        setPhase(newPhase);
        setTimer(settings.phaseDuration);
        
        // Check for movement if switching to FREEZE
        if (phase === 'MOVE' && settings.eliminationEnabled && settings.enableColorTracking) {
          checkPlayerMovement();
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameActive, phase, timer, settings, cameraReady]);
  
  // Color tracking effect
  useEffect(() => {
    if (!settings.enableCamera || !settings.enableColorTracking || !gameActive || !cameraReady) {
      return;
    }
    
    if (!videoRef.current || !canvasRef.current) {
      console.log("Video or canvas ref not available");
      return;
    }
    
    console.log("Setting up color tracking");
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      console.error("Failed to get canvas context");
      return;
    }
    
    addLog("Color tracking initialized");
    
    let animationFrame: number;
    let frameCount = 0;
    let lastPositions: Record<string, {x: number, y: number} | null> = {};
    
    const trackColors = () => {
      try {
        // Only process every 2 frames for performance
        frameCount++;
        if (frameCount % 2 !== 0) {
          animationFrame = requestAnimationFrame(trackColors);
          return;
        }
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Track each player by color
        const updatedPlayers = [...players];
        let anyUpdated = false;
        
        for (let i = 0; i < updatedPlayers.length; i++) {
          const player = updatedPlayers[i];
          if (player.eliminated) continue;
          
          // Find color centroid
          const position = findColorCentroid(imageData, player.color);
          
          // Only update if we found a position or if this is the first time we're not finding it
          if (position || !lastPositions[player.color]) {
            if (position) {
              // Smooth position updates with previous position for stability
              if (lastPositions[player.color]) {
                // Apply some smoothing to reduce jitter
                position.x = position.x * 0.7 + lastPositions[player.color]!.x * 0.3;
                position.y = position.y * 0.7 + lastPositions[player.color]!.y * 0.3;
              }
              
              // Update positions
              updatedPlayers[i] = {
                ...player,
                lastPosition: phase === 'MOVE' ? player.position : player.lastPosition,
                position: position
              };
              
              // Store this position for next frame smoothing
              lastPositions[player.color] = position;
              anyUpdated = true;
              
              // Log occasionally
              if (frameCount % 60 === 0) {
                console.log(`Tracking ${player.color} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
              }
            } else {
              // Lost tracking
              lastPositions[player.color] = null;
              if (frameCount % 30 === 0) {
                console.log(`Lost tracking of ${player.color}`);
              }
            }
          }
        }
        
        if (anyUpdated) {
          setPlayers(updatedPlayers);
        }
      } catch (error) {
        console.error("Error in tracking:", error);
      }
      
      // Continue the tracking loop
      animationFrame = requestAnimationFrame(trackColors);
    };
    
    // Start the tracking loop
    trackColors();
    addLog("Started color tracking");
    
    return () => {
      cancelAnimationFrame(animationFrame);
      addLog("Stopped color tracking");
    };
  }, [settings.enableCamera, settings.enableColorTracking, gameActive, cameraReady, players, phase]);
  
  // Check player movement
  const checkPlayerMovement = () => {
    if (!settings.eliminationEnabled) return;
    
    addLog(`Checking player movement, threshold: ${settings.movementThreshold}`);
    
    const updatedPlayers = players.map(player => {
      if (player.eliminated) return player;
      
      // Calculate movement
      const dx = player.position.x - player.lastPosition.x;
      const dy = player.position.y - player.lastPosition.y;
      const movement = Math.sqrt(dx * dx + dy * dy);
      
      addLog(`Player ${player.color}: movement = ${movement.toFixed(1)}, threshold = ${settings.movementThreshold}`);
      
      // Eliminate if moved too much
      if (movement > settings.movementThreshold) {
        addLog(`Player ${player.color} eliminated: moved ${movement.toFixed(1)}px`, 'warning');
        return { ...player, eliminated: true };
      }
      
      return player;
    });
    
    setPlayers(updatedPlayers);
    
    // Check if game is over
    const activePlayers = updatedPlayers.filter(p => !p.eliminated);
    if (activePlayers.length <= 1 && updatedPlayers.some(p => p.eliminated)) {
      endGame();
    }
  };
  
  // End the game
  const endGame = () => {
    setGameActive(false);
    setPhase('GAME_OVER');
    
    // Award points to survivors
    setPlayers(prev => prev.map(player => 
      player.eliminated ? player : { ...player, score: player.score + 10 }
    ));
    
    addLog("Game over");
  };
  
  // Find color centroid in image
  const findColorCentroid = (imageData: ImageData, playerColor: string): { x: number, y: number } | null => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    let totalX = 0;
    let totalY = 0;
    let totalWeight = 0;
    let matchingPixels = 0;
    
    // Sample every Nth pixel for performance
    // Use a smaller step size for higher accuracy (but more CPU usage)
    const sampleStep = 5;
    
    // Color detection parameters - wider ranges for better detection
    let targetR, targetG, targetB;
    let colorThreshold;
    
    if (playerColor === 'custom') {
      // Use the captured custom color
      [targetR, targetG, targetB] = customColor;
      colorThreshold = 60; // Wider threshold for custom colors
    } else {
      // Predefined color targets (RGB values)
      switch (playerColor) {
        case 'red':
          targetR = 200; targetG = 30; targetB = 30;
          colorThreshold = 100;
          break;
        case 'green':
          targetR = 30; targetG = 200; targetB = 30;
          colorThreshold = 100;
          break;
        case 'blue':
          targetR = 30; targetG = 30; targetB = 200;
          colorThreshold = 100;
          break;
        case 'yellow':
          targetR = 200; targetG = 200; targetB = 30;
          colorThreshold = 100;
          break;
        default:
          return null;
      }
    }
    
    // Use HSV-like approach for better color matching
    const isTargetColorBright = (targetR + targetG + targetB) > 350;
    
    // HSV-based color matching is more robust to lighting changes
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Skip very dark pixels (likely background)
        const brightness = r + g + b;
        if (brightness < 80 && !isTargetColorBright) continue;
        
        // Calculate color difference using weighted Euclidean distance
        const diffR = r - targetR;
        const diffG = g - targetG;
        const diffB = b - targetB;
        
        // Different weights for different channels
        const distance = Math.sqrt(
          (diffR * diffR * 0.3) + 
          (diffG * diffG * 0.4) + 
          (diffB * diffB * 0.3)
        );
        
        // Calculate match quality (0-1)
        if (distance < colorThreshold) {
          // Calculate weight based on how close the match is
          const weight = 1.0 - (distance / colorThreshold);
          
          // Add to weighted average
          totalX += x * weight;
          totalY += y * weight;
          totalWeight += weight;
          matchingPixels++;
          
          // Debugging: Uncomment to see which pixels get detected
          // if (matchingPixels % 100 === 0) {
          //   console.log(`${playerColor} match: RGB(${r},${g},${b}), distance: ${distance.toFixed(1)}`);
          // }
        }
      }
    }
    
    // Minimum pixels required to detect a color
    const minPixels = 10;
    
    if (matchingPixels >= minPixels && totalWeight > 0) {
      // Calculate weighted centroid
      return {
        x: totalX / totalWeight,
        y: totalY / totalWeight
      };
    }
    
    return null;
  };
  
  // Handle video click for color capture
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!captureMode || !videoRef.current || !canvasRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get click coordinates
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 480 / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setCapturePoint({ x, y });
    
    // Capture color at this point
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    const color = captureColorAt(imageData, x, y);
    setCustomColor(color);
    
    // Add custom player if not exists
    if (!players.some(p => p.color === 'custom')) {
      addPlayer('custom');
    }
    
    setCaptureMode(false);
    addLog(`Captured custom color: RGB(${color.join(', ')})`);
  };
  
  // Get phase color
  const getPhaseColor = () => {
    switch (phase) {
      case 'MOVE': return 'bg-green-500';
      case 'FREEZE': return 'bg-red-500';
      case 'SETUP': return 'bg-blue-500';
      case 'GAME_OVER': return 'bg-gray-500';
      case 'MENU': return 'bg-purple-500';
    }
  };
  
  // Render player color
  const getPlayerColor = (color: string) => {
    return color === 'custom' ? 'purple' : color;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">
          Red Light, Green Light
        </h1>
        
        {/* Phase display */}
        <div className="text-center mb-4">
          <div className={`inline-block px-6 py-3 rounded-lg text-xl font-bold ${getPhaseColor()}`}>
            {phase} Phase {gameActive && `- ${timer}s`}
          </div>
        </div>
        
        {/* Main menu */}
        {phase === 'MENU' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-center mb-6">Main Menu</h2>
            
            <div className="mb-6">
              <h3 className="text-xl mb-3">Game Settings</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Camera</span>
                  <button 
                    className={`px-3 py-1 rounded ${settings.enableCamera ? 'bg-green-500' : 'bg-red-500'}`}
                    onClick={() => {
                      const newSettings = {...settings, enableCamera: !settings.enableCamera};
                      setSettings(newSettings);
                      
                      // If enabling camera, initialize it immediately
                      if (newSettings.enableCamera) {
                        console.log("Initializing camera from settings menu");
                        setTimeout(() => initCamera(), 100);
                      }
                    }}
                  >
                    {settings.enableCamera ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Color Tracking</span>
                  <button 
                    className={`px-3 py-1 rounded ${settings.enableColorTracking ? 'bg-green-500' : 'bg-red-500'}`}
                    onClick={() => {
                      const newTrackingEnabled = !settings.enableColorTracking;
                      setSettings({...settings, enableColorTracking: newTrackingEnabled});
                      
                      // If enabling tracking, make sure camera is on too
                      if (newTrackingEnabled && !settings.enableCamera) {
                        console.log("Auto-enabling camera for color tracking");
                        setSettings(prev => ({...prev, enableCamera: true}));
                        setTimeout(() => initCamera(), 100);
                      }
                    }}
                  >
                    {settings.enableColorTracking ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Debug Mode</span>
                  <button 
                    className={`px-3 py-1 rounded ${settings.debugMode ? 'bg-green-500' : 'bg-red-500'}`}
                    onClick={() => setSettings({...settings, debugMode: !settings.debugMode})}
                  >
                    {settings.debugMode ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Elimination</span>
                  <button 
                    className={`px-3 py-1 rounded ${settings.eliminationEnabled ? 'bg-green-500' : 'bg-red-500'}`}
                    onClick={() => setSettings({...settings, eliminationEnabled: !settings.eliminationEnabled})}
                  >
                    {settings.eliminationEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Phase Duration</span>
                  <div className="flex items-center">
                    <button 
                      className="px-2 bg-blue-500 rounded-l"
                      onClick={() => setSettings({...settings, phaseDuration: Math.max(1, settings.phaseDuration - 1)})}
                    >-</button>
                    <span className="px-3">{settings.phaseDuration}s</span>
                    <button 
                      className="px-2 bg-blue-500 rounded-r"
                      onClick={() => setSettings({...settings, phaseDuration: settings.phaseDuration + 1})}
                    >+</button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Movement Threshold</span>
                  <div className="flex items-center">
                    <button 
                      className="px-2 bg-blue-500 rounded-l"
                      onClick={() => setSettings({...settings, movementThreshold: Math.max(5, settings.movementThreshold - 5)})}
                    >-</button>
                    <span className="px-3">{settings.movementThreshold}px</span>
                    <button 
                      className="px-2 bg-blue-500 rounded-r"
                      onClick={() => setSettings({...settings, movementThreshold: settings.movementThreshold + 5})}
                    >+</button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <span>Camera Selection</span>
                  <div className="flex gap-2">
                    <button 
                      className={`px-3 py-1 rounded ${settings.preferredCamera === 'environment' ? 'bg-blue-500' : 'bg-gray-600'}`}
                      onClick={() => setSettings({...settings, preferredCamera: 'environment'})}
                    >
                      Back
                    </button>
                    <button 
                      className={`px-3 py-1 rounded ${settings.preferredCamera === 'user' ? 'bg-blue-500' : 'bg-gray-600'}`}
                      onClick={() => setSettings({...settings, preferredCamera: 'user'})}
                    >
                      Front
                    </button>
                    <button 
                      className={`px-3 py-1 rounded ${settings.preferredCamera === 'any' ? 'bg-blue-500' : 'bg-gray-600'}`}
                      onClick={() => setSettings({...settings, preferredCamera: 'any'})}
                    >
                      Any
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button 
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold"
                onClick={() => setPhase('SETUP')}
              >
                Start Setup
              </button>
            </div>
          </div>
        )}
        
        {/* Game setup */}
        {phase === 'SETUP' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-center mb-4">Player Setup</h2>
            
            <div className="flex justify-center gap-4 mb-6">
              {['red', 'green', 'blue', 'yellow', 'custom'].map(color => (
                <div key={color} className="flex flex-col items-center">
                  <button
                    className={`w-12 h-12 rounded-full ${players.some(p => p.color === color) ? 'ring-2 ring-white' : ''}`}
                    style={{ backgroundColor: getPlayerColor(color) }}
                    onClick={() => {
                      if (players.some(p => p.color === color)) {
                        removePlayer(color);
                      } else {
                        addPlayer(color);
                      }
                    }}
                  >
                    {players.some(p => p.color === color) && (
                      <span className="text-white text-lg">✓</span>
                    )}
                  </button>
                  <span className="text-xs mt-1">{color}</span>
                </div>
              ))}
            </div>
            
            {/* Current players */}
            {players.length > 0 && (
              <div className="mb-6">
                <h3 className="text-center mb-2">Selected Players</h3>
                <div className="flex justify-center gap-2">
                  {players.map(player => (
                    <div 
                      key={player.color}
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: getPlayerColor(player.color) }}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Camera preview */}
            {settings.enableCamera && (
              <div className="relative mb-6">
                <h3 className="text-center mb-2">
                  Camera Preview {!cameraReady && "(Requesting camera access...)"}
                </h3>
                <div className="relative max-w-md mx-auto">
                  {!cameraReady && (
                    <div 
                      className="w-full h-64 bg-gray-800 border-2 border-gray-700 rounded flex items-center justify-center"
                      onClick={() => initCamera()}
                    >
                      <button 
                        className="px-4 py-2 bg-blue-500 rounded-lg"
                        onClick={() => initCamera()}
                      >
                        Request Camera Access
                      </button>
                    </div>
                  )}
                  
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-64 object-cover border-2 border-gray-700 rounded ${captureMode ? 'cursor-crosshair' : ''} ${!cameraReady ? 'hidden' : ''}`}
                    onClick={handleVideoClick}
                  />
                  
                  {captureMode && cameraReady && (
                    <div className="absolute top-0 left-0 right-0 bg-black/50 text-white text-center p-2">
                      Click on any color to capture for tracking
                    </div>
                  )}
                  
                  {capturePoint && cameraReady && (
                    <div 
                      className="absolute w-6 h-6 border-2 border-white rounded-full -ml-3 -mt-3"
                      style={{ 
                        left: `${(capturePoint.x / 640) * 100}%`, 
                        top: `${(capturePoint.y / 480) * 100}%` 
                      }}
                    />
                  )}
                  
                  {/* Capture button */}
                  {cameraReady && (
                    <div className="absolute bottom-2 right-2">
                      <button
                        className={`px-3 py-1 rounded font-bold ${captureMode ? 'bg-green-500' : 'bg-purple-500'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaptureMode(!captureMode);
                        }}
                      >
                        {captureMode ? 'Cancel' : 'Capture Color'}
                      </button>
                    </div>
                  )}
                </div>
                
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="hidden"
                />
              </div>
            )}
            
            <div className="flex justify-center gap-4">
              <button
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold"
                onClick={goToMenu}
              >
                Back to Menu
              </button>
              
              <button
                className={`px-6 py-3 rounded-lg font-bold ${players.length > 0 ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 cursor-not-allowed'}`}
                disabled={players.length === 0}
                onClick={startGame}
              >
                Start Game
              </button>
            </div>
          </div>
        )}
        
        {/* Active game */}
        {(phase === 'MOVE' || phase === 'FREEZE') && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl">Game Active</h2>
              <div>
                <span className="text-gray-300">Players: {players.filter(p => !p.eliminated).length}/{players.length}</span>
              </div>
            </div>
            
            {/* Camera view */}
            {settings.enableCamera && (
              <div className="relative mb-6">
                <div className={`relative border-4 ${phase === 'MOVE' ? 'border-green-500' : 'border-red-500'} rounded-lg overflow-hidden`}>
                  {!cameraReady && (
                    <div 
                      className="w-full h-64 bg-gray-800 flex items-center justify-center"
                      onClick={() => initCamera()}
                    >
                      <button 
                        className="px-4 py-2 bg-blue-500 rounded-lg"
                        onClick={() => initCamera()}
                      >
                        Request Camera Access
                      </button>
                    </div>
                  )}
                  
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-64 object-cover ${!cameraReady ? 'hidden' : ''}`}
                  />
                  
                  {/* Phase indicator */}
                  <div className="absolute top-2 left-0 right-0 text-center">
                    <div className={`inline-block px-4 py-1 rounded font-bold ${phase === 'MOVE' ? 'bg-green-500' : 'bg-red-500'}`}>
                      {phase === 'MOVE' ? 'MOVE!' : 'FREEZE!'}
                    </div>
                  </div>
                  
                  {/* Camera status indicator */}
                  {settings.enableCamera && !cameraReady && (
                    <div className="absolute top-10 left-0 right-0 text-center">
                      <div className="inline-block px-4 py-1 bg-yellow-500 rounded text-sm">
                        Camera not available
                      </div>
                    </div>
                  )}
                  
                  {/* Player indicators */}
                  {settings.enableColorTracking && cameraReady && players.map(player => {
                    if (player.eliminated) return null;
                    
                    const x = (player.position.x / 640) * 100;
                    const y = (player.position.y / 480) * 100;
                    
                    return (
                      <div 
                        key={player.color}
                        className="absolute w-6 h-6 rounded-full -ml-3 -mt-3 border-2 border-white"
                        style={{ 
                          backgroundColor: getPlayerColor(player.color),
                          left: `${x}%`,
                          top: `${y}%`
                        }}
                      />
                    );
                  })}
                  
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="hidden"
                  />
                </div>
              </div>
            )}
            
            {/* Phase announcement */}
            {!settings.enableCamera && (
              <div className={`border-4 ${phase === 'MOVE' ? 'border-green-500' : 'border-red-500'} p-8 mb-6 rounded-lg text-center`}>
                {phase === 'MOVE' ? (
                  <p className="text-4xl text-green-500 font-bold">MOVE!</p>
                ) : (
                  <p className="text-4xl text-red-500 font-bold">FREEZE!</p>
                )}
              </div>
            )}
            
            {/* Player status */}
            <div className="mb-6">
              <h3 className="text-center mb-2">Player Status</h3>
              <div className="flex justify-center gap-3">
                {players.map(player => (
                  <div 
                    key={player.color}
                    className={`px-3 py-2 rounded ${player.eliminated ? 'bg-gray-700' : 'bg-gray-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getPlayerColor(player.color) }}
                      />
                      <span>{player.color}</span>
                      {player.eliminated && <span className="text-red-500">✗</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-bold"
                onClick={resetGame}
              >
                Reset Game
              </button>
            </div>
          </div>
        )}
        
        {/* Game over */}
        {phase === 'GAME_OVER' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-center mb-6">Game Over</h2>
            
            {/* Winners */}
            <div className="mb-6">
              {players.some(p => !p.eliminated) ? (
                <div className="text-center">
                  <h3 className="text-xl mb-4">Winners</h3>
                  <div className="flex justify-center gap-4">
                    {players.filter(p => !p.eliminated).map(player => (
                      <div 
                        key={player.color}
                        className="p-4 bg-gray-700 rounded-lg text-center"
                      >
                        <div 
                          className="w-12 h-12 rounded-full mx-auto mb-2"
                          style={{ backgroundColor: getPlayerColor(player.color) }}
                        />
                        <div className="text-lg font-bold">{player.color}</div>
                        <div className="text-sm text-gray-300">Score: {player.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-xl mb-6">No players survived!</div>
              )}
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold"
                onClick={goToMenu}
              >
                Main Menu
              </button>
              
              <button
                className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-bold"
                onClick={resetGame}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
        
        {/* Debug logs */}
        {settings.debugMode && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold">Debug Logs</h3>
              <button 
                className="text-xs bg-red-500 px-2 py-1 rounded"
                onClick={() => setDebugLogs([])}
              >
                Clear
              </button>
            </div>
            <div className="h-48 overflow-y-auto bg-black p-2 rounded text-xs font-mono">
              {debugLogs.length === 0 ? (
                <div className="text-gray-500">No logs yet</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'warning' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;