import React, { useState, useEffect } from 'react';
import { Camera } from './components/Camera';
import { useGameStore } from './store/gameStore';

function App() {
  // Get game state from store
  const { 
    phase, 
    gameActive, 
    players, 
    timeRemaining,
    // difficulty, - unused but kept for reference
    // detectionThreshold, - unused but kept for reference
    // customColorValues, - unused but kept for reference
    playerColors,
    cameraReady,
    // setCameraReady, - unused but kept for reference
    addPlayer, 
    removePlayer,
    startGame,
    resetGame,
    // updateCustomColor, - unused but kept for reference
    updateTimer,
    setDifficulty,
    setDetectionThreshold,
    updatePlayerColor
  } = useGameStore();
  
  // Local state for UI
  const [debugLogs, setDebugLogs] = useState<Array<{timestamp: number, message: string, type: string}>>([]);
  const [showSettings, setShowSettings] = useState(false);
  // These state values were used in previous versions of the app
  // Now handled in the Camera component
  // const [captureMode, setCaptureMode] = useState(false);
  // const [capturePoint, setCapturePoint] = useState<{x: number, y: number} | null>(null);
  const [newPlayerColor, setNewPlayerColor] = useState<[number, number, number]>([200, 50, 50]);
  
  // Settings state that should persist throughout gameplay
  const [settings, setSettings] = useState({
    enableCamera: true,
    enableColorTracking: true,
    debugMode: false,
    moveDuration: 5,
    freezeDuration: 5,
    eliminationEnabled: true,
    movementThreshold: 30,
    preferredCamera: 'environment' as 'environment' | 'user' | 'any'
  });
  
  // Add a debug log
  const addLog = React.useCallback((message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    if (settings.debugMode) {
      setDebugLogs(prev => [
        { timestamp: Date.now(), message, type },
        ...prev.slice(0, 99) // Keep only last 100 logs
      ]);
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }, [settings.debugMode, setDebugLogs]);
  
  // Generate a random RGB color that's easy to track
  const generateRandomColor = (): [number, number, number] => {
    // Generate a bright, saturated color by ensuring at least one channel is high
    // and at least one channel is low
    const channels = [
      Math.floor(Math.random() * 100) + 155, // 155-255 (bright)
      Math.floor(Math.random() * 100),      // 0-100 (dim)
      Math.floor(Math.random() * 100)       // 0-100 (dim)
    ];
    
    // Shuffle the channels so the bright one isn't always red
    return shuffle(channels) as [number, number, number];
  };
  
  // Shuffle array (Fisher-Yates algorithm)
  const shuffle = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };
  
  // Go to setup
  const goToSetup = () => {
    resetGame();
    addLog("Game setup started");
  };
  
  // Keep this function for future use
  // const goToMenu = () => {
  //   resetGame();
  //   addLog("Returned to main menu");
  // };
  
  // Add a new player with custom color
  const addNewPlayer = () => {
    const playerId = `player${players.length + 1}`;
    addPlayer(playerId);
    updatePlayerColor(playerId, newPlayerColor[0], newPlayerColor[1], newPlayerColor[2]);
    
    // Generate a new random color for the next player
    setNewPlayerColor(generateRandomColor());
    
    addLog(`Added new player with custom color: RGB(${newPlayerColor.join(',')})`);
  };
  
  // Apply threshold setting
  useEffect(() => {
    // Update the movement threshold in the store
    setDetectionThreshold(settings.movementThreshold);
    addLog(`Movement threshold set to ${settings.movementThreshold}px`);
  }, [settings.movementThreshold, setDetectionThreshold, addLog]);
  
  // Apply settings changes
  useEffect(() => {
    // Update settings that affect the game store
    if (settings.enableColorTracking && !settings.enableCamera) {
      // Auto-enable camera if color tracking is enabled
      setSettings(prev => ({...prev, enableCamera: true}));
    }
    
    addLog(`Settings updated: camera=${settings.enableCamera}, tracking=${settings.enableColorTracking}`);
  }, [settings, addLog]);
  
  // Timer effect for game phases
  useEffect(() => {
    if (!gameActive) return;
    
    // Update timer every 100ms
    const interval = setInterval(() => {
      updateTimer();
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameActive, updateTimer]);
  
  // Format time for display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };
  
  // Get phase color
  const getPhaseColor = () => {
    switch (phase) {
      case 'MOVE': return 'bg-green-500';
      case 'FREEZE': return 'bg-red-500';
      case 'SETUP': return 'bg-blue-500';
      case 'GAME_OVER': return 'bg-gray-500';
      default: return 'bg-purple-500';
    }
  };
  
  // Set custom phase durations
  const applyPhaseDurations = () => {
    // Convert seconds to milliseconds
    const moveDuration = settings.moveDuration * 1000;
    const freezeDuration = settings.freezeDuration * 1000;
    
    // Create a custom difficulty setting
    setDifficulty('custom');
    
    // Update the game store with custom durations
    useGameStore.setState({
      moveDuration,
      freezeDuration
    });
    
    addLog(`Custom phase durations set: Move=${settings.moveDuration}s, Freeze=${settings.freezeDuration}s`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">
          Red Light, Green Light
        </h1>
        
        {/* Phase display with timer */}
        <div className="text-center mb-4">
          <div className={`inline-block px-6 py-3 rounded-lg text-xl font-bold ${getPhaseColor()}`}>
            {phase} Phase {gameActive && ` - ${formatTime(timeRemaining)}`}
          </div>
        </div>
        
        {/* Main menu */}
        {phase === 'SETUP' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-center mb-4">Player Setup</h2>
            
            {/* Settings panel toggle */}
            <div className="flex justify-end mb-4">
              <button
                className="px-3 py-1 bg-blue-500 rounded-lg text-sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                {showSettings ? 'Hide Settings' : 'Game Settings'}
              </button>
            </div>
            
            {/* Settings panel */}
            {showSettings && (
              <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                <h3 className="text-lg font-bold mb-3">Game Settings</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {/* Movement Sensitivity */}
                  <div className="bg-gray-600 p-3 rounded-lg">
                    <label className="block mb-2">Movement Sensitivity</label>
                    <div className="flex items-center">
                      <span className="mr-2">High</span>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={settings.movementThreshold}
                        onChange={(e) => setSettings({
                          ...settings,
                          movementThreshold: parseInt(e.target.value)
                        })}
                        className="flex-1 mx-2"
                      />
                      <span className="ml-2">Low</span>
                    </div>
                    <div className="text-center text-sm mt-1">
                      {settings.movementThreshold}px threshold
                    </div>
                  </div>
                  
                  {/* Camera options */}
                  <div className="bg-gray-600 p-3 rounded-lg">
                    <label className="block mb-2">Camera Options</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={`px-2 py-1 rounded ${settings.preferredCamera === 'environment' ? 'bg-blue-500' : 'bg-gray-500'}`}
                        onClick={() => setSettings({...settings, preferredCamera: 'environment'})}
                      >
                        Back Camera
                      </button>
                      <button
                        className={`px-2 py-1 rounded ${settings.preferredCamera === 'user' ? 'bg-blue-500' : 'bg-gray-500'}`}
                        onClick={() => setSettings({...settings, preferredCamera: 'user'})}
                      >
                        Front Camera
                      </button>
                    </div>
                  </div>
                  
                  {/* Timer durations */}
                  <div className="bg-gray-600 p-3 rounded-lg">
                    <label className="block mb-2">Phase Durations</label>
                    <div className="flex items-center mb-2">
                      <span className="w-16 inline-block">Move:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={settings.moveDuration}
                        onChange={(e) => setSettings({
                          ...settings,
                          moveDuration: parseInt(e.target.value) || 5
                        })}
                        className="w-16 px-2 py-1 bg-gray-700 rounded text-center"
                      />
                      <span className="ml-2">seconds</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-16 inline-block">Freeze:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={settings.freezeDuration}
                        onChange={(e) => setSettings({
                          ...settings, 
                          freezeDuration: parseInt(e.target.value) || 5
                        })}
                        className="w-16 px-2 py-1 bg-gray-700 rounded text-center"
                      />
                      <span className="ml-2">seconds</span>
                    </div>
                    <button
                      className="mt-2 px-2 py-1 bg-green-500 rounded w-full text-sm"
                      onClick={applyPhaseDurations}
                    >
                      Apply Timer Settings
                    </button>
                  </div>
                  
                  {/* Debug mode */}
                  <div className="bg-gray-600 p-3 rounded-lg">
                    <label className="block mb-2">Debug Options</label>
                    <div className="flex items-center">
                      <button
                        className={`px-3 py-1 rounded ${settings.debugMode ? 'bg-green-500' : 'bg-gray-500'}`}
                        onClick={() => setSettings({...settings, debugMode: !settings.debugMode})}
                      >
                        {settings.debugMode ? 'Debug Mode: ON' : 'Debug Mode: OFF'}
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Shows detailed logs for troubleshooting
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Always show camera component regardless of phase */}
            <div className="relative mb-6">
              <h3 className="text-center mb-2">
                Camera Preview {!cameraReady && "(Requesting camera access...)"}
              </h3>
              <div className="relative max-w-md mx-auto">
                {/* Camera component that now persists regardless of game phase */}
                <Camera />
              </div>
            </div>
            
            {/* Add new player section */}
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-center mb-3">Add New Player</h3>
              
              <div className="flex items-center justify-center mb-3">
                <div
                  className="w-12 h-12 rounded-full mr-4"
                  style={{ 
                    backgroundColor: `rgb(${newPlayerColor[0]}, ${newPlayerColor[1]}, ${newPlayerColor[2]})` 
                  }}
                />
                <button 
                  className="px-4 py-2 bg-green-500 rounded-lg"
                  onClick={addNewPlayer}
                >
                  Add Player
                </button>
                <button 
                  className="px-3 py-2 ml-2 bg-purple-500 rounded-lg"
                  onClick={() => setNewPlayerColor(generateRandomColor())}
                >
                  Generate Random Color
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                <div>
                  <label className="block text-xs mb-1 text-center">Red</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={newPlayerColor[0]}
                    onChange={(e) => setNewPlayerColor([
                      parseInt(e.target.value),
                      newPlayerColor[1],
                      newPlayerColor[2]
                    ])}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-center">Green</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={newPlayerColor[1]}
                    onChange={(e) => setNewPlayerColor([
                      newPlayerColor[0],
                      parseInt(e.target.value),
                      newPlayerColor[2]
                    ])}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-center">Blue</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={newPlayerColor[2]}
                    onChange={(e) => setNewPlayerColor([
                      newPlayerColor[0],
                      newPlayerColor[1],
                      parseInt(e.target.value)
                    ])}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-center mt-2 text-gray-400">
                RGB: ({newPlayerColor.join(', ')})
              </p>
            </div>
            
            {/* Current players */}
            {players.length > 0 && (
              <div className="mb-6">
                <h3 className="text-center mb-2">Current Players ({players.length})</h3>
                <div className="flex flex-wrap justify-center gap-4 mb-4">
                  {players.map(player => {
                    const playerColor = playerColors[player.id] || [0, 0, 0];
                    return (
                      <div 
                        key={player.id}
                        className="bg-gray-700 p-3 rounded-lg flex flex-col items-center"
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div 
                            className="w-8 h-8 rounded-full"
                            style={{ 
                              backgroundColor: `rgb(${playerColor[0]}, ${playerColor[1]}, ${playerColor[2]})` 
                            }}
                          />
                          <span className="mx-2 text-sm">{player.id}</span>
                          <button
                            className="text-red-500 hover:text-red-300 text-sm"
                            onClick={() => removePlayer(player.id)}
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 w-full">
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="255"
                              value={playerColor[0]}
                              onChange={(e) => updatePlayerColor(
                                player.id,
                                parseInt(e.target.value),
                                playerColor[1],
                                playerColor[2]
                              )}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="255"
                              value={playerColor[1]}
                              onChange={(e) => updatePlayerColor(
                                player.id,
                                playerColor[0],
                                parseInt(e.target.value),
                                playerColor[2]
                              )}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <input
                              type="range"
                              min="0"
                              max="255"
                              value={playerColor[2]}
                              onChange={(e) => updatePlayerColor(
                                player.id,
                                playerColor[0],
                                playerColor[1],
                                parseInt(e.target.value)
                              )}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="flex justify-center gap-4">
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
        
        {/* Active game - Always render Camera component */}
        {(phase === 'MOVE' || phase === 'FREEZE') && (
          <div className="fixed inset-0 z-40 bg-black flex flex-col justify-center items-center">
            <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 z-30">
              <h2 className="text-xl bg-black/50 p-2 rounded-lg">Game Active</h2>
              <div>
                <span className="text-gray-300 bg-black/50 p-2 rounded-lg">Players: {players.filter(p => !p.eliminated).length}/{players.length}</span>
              </div>
            </div>
            
            {/* Camera view - fullscreen */}
            <div className="w-full h-full flex items-center justify-center">
              <div className={`w-full h-full max-w-screen max-h-screen relative border-8 ${phase === 'MOVE' ? 'border-green-500' : 'border-red-500'} overflow-hidden`}>
                {/* Camera component is maintained throughout all phases */}
                <Camera />
                
                {/* Phase indicator */}
                <div className="absolute top-16 left-0 right-0 text-center">
                  <div className={`inline-block px-6 py-2 rounded-full font-bold text-xl ${phase === 'MOVE' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {phase === 'MOVE' ? 'MOVE!' : 'FREEZE!'}
                  </div>
                </div>
                
                {/* Movement threshold indicator */}
                <div className="absolute bottom-4 right-4">
                  <div className="bg-black/80 px-3 py-2 rounded-full text-sm font-bold">
                    Movement: {settings.movementThreshold}px
                  </div>
                </div>
              </div>
            </div>
            
            {/* Player status - position at the bottom of the screen */}
            <div className="fixed bottom-4 left-0 right-0 z-30">
              <div className="flex flex-wrap justify-center gap-3">
                {players.map(player => {
                  const playerColor = playerColors[player.id] || [0, 0, 0];
                  return (
                    <div 
                      key={player.id}
                      className={`px-4 py-2 rounded-full shadow-lg ${player.eliminated ? 'bg-black/70' : 'bg-black/50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full"
                          style={{ 
                            backgroundColor: `rgb(${playerColor[0]}, ${playerColor[1]}, ${playerColor[2]})` 
                          }}
                        />
                        <span>{player.id}</span>
                        {player.eliminated && <span className="text-red-500 font-bold">✗</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="absolute top-20 right-4 z-30">
              <button
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-full shadow-lg font-bold"
                onClick={resetGame}
              >
                Reset Game
              </button>
            </div>
          </div>
        )}
        
        {/* Game over - fullscreen with camera background */}
        {phase === 'GAME_OVER' && (
          <div className="fixed inset-0 z-40 bg-black flex flex-col justify-center items-center">
            {/* Show camera in game over state too */}
            <div className="absolute inset-0 opacity-40">
              <Camera />
            </div>
            
            <div className="relative z-10 w-full max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-8 text-white animate-pulse">Game Over</h2>
              
              {/* Winners */}
              <div className="mb-8">
                {players.some(p => !p.eliminated) ? (
                  <div className="text-center">
                    <h3 className="text-2xl mb-6 text-white">Winners</h3>
                    <div className="flex justify-center gap-6">
                      {players.filter(p => !p.eliminated).map(player => {
                        const playerColor = playerColors[player.id] || [0, 0, 0];
                        return (
                          <div 
                            key={player.id}
                            className="p-6 bg-gray-800/90 rounded-xl text-center shadow-2xl backdrop-blur-sm"
                          >
                            <div 
                              className="w-20 h-20 rounded-full mx-auto mb-4 shadow-lg"
                              style={{ 
                                backgroundColor: `rgb(${playerColor[0]}, ${playerColor[1]}, ${playerColor[2]})` 
                              }}
                            />
                            <div className="text-xl font-bold">{player.id}</div>
                            <div className="text-lg text-white mt-2">Score: {player.score}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-2xl mb-8 text-white p-6 bg-black/70 rounded-xl">No players survived!</div>
                )}
              </div>
              
              <div className="flex justify-center gap-4">
                <button
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-bold text-xl shadow-xl transition-all transform hover:scale-105"
                  onClick={goToSetup}
                >
                  Play Again
                </button>
              </div>
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