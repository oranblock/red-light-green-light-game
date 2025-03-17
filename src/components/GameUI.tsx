import React from 'react';
import { useGameStore } from '../store/gameStore';
import { Timer, Trophy, Skull, Zap, User, Users, Medal } from 'lucide-react';
import { cn } from '../lib/utils';

export function GameUI() {
  const { 
    phase, 
    timeRemaining,
    difficulty,
    players,
    activePlayers,
    leadingPlayer,
    gameActive,
    winner
  } = useGameStore();

  // Mapping for difficulty display names
  const difficultyLabels = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard'
  };

  // Mapping for difficulty colors
  const difficultyColors = {
    easy: 'text-green-500',
    medium: 'text-yellow-500',
    hard: 'text-red-500'
  };

  // Get player color name
  const getPlayerColorName = (id: string) => {
    const player = players.find(p => p.id === id);
    if (!player) return '';
    
    // Handle custom color differently
    if (player.color === 'custom') {
      return 'Custom';
    }
    
    return player.color.charAt(0).toUpperCase() + player.color.slice(1);
  };

  // Format time remaining
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}`;
  };

  return (
    <div className="absolute top-0 left-0 right-0 p-4">
      <div className="flex justify-between items-center">
        {/* Timer and phase display */}
        <div className="bg-white/90 rounded-lg p-3 shadow-lg text-black">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            <span className="font-bold">{formatTime(timeRemaining)}s</span>
          </div>
          <div className="text-sm mt-1 flex items-center gap-1">
            {phase === 'FREEZE' ? (
              <><span className="h-2 w-2 rounded-full bg-red-500"></span> FREEZE</>
            ) : phase === 'MOVE' ? (
              <><span className="h-2 w-2 rounded-full bg-green-500"></span> MOVE</>
            ) : phase === 'SETUP' ? (
              <><span className="h-2 w-2 rounded-full bg-blue-500"></span> SETUP</>
            ) : (
              <><span className="h-2 w-2 rounded-full bg-gray-500"></span> GAME OVER</>
            )}
          </div>
        </div>

        {/* Player information */}
        <div className="bg-white/90 rounded-lg p-3 shadow-lg text-black">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="font-bold">{activePlayers} / {players.length}</span>
          </div>
          {leadingPlayer && (
            <div className="text-sm mt-1 flex items-center gap-1">
              <Medal className="w-4 h-4 text-yellow-500" />
              <span>{getPlayerColorName(leadingPlayer)} Leading</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Difficulty indicator */}
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-white/90 rounded-lg px-3 py-1 shadow-lg text-black">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${difficultyColors[difficulty]}`} />
          <span className={`text-sm font-medium ${difficultyColors[difficulty]}`}>
            {difficultyLabels[difficulty]} Mode
          </span>
        </div>
      </div>

      {/* Player status indicators */}
      <div className="fixed bottom-4 left-4 right-4 flex justify-center gap-2">
        {players.map(player => (
          <div 
            key={player.id}
            className={cn(
              "p-2 rounded-lg shadow-lg text-white flex items-center gap-1",
              player.eliminated ? "bg-gray-700/90" : ""
            )}
            style={{ 
              backgroundColor: player.eliminated 
                ? 'rgba(55, 65, 81, 0.9)' 
                : player.color === 'red' ? 'rgba(239, 68, 68, 0.9)'
                : player.color === 'green' ? 'rgba(34, 197, 94, 0.9)'
                : player.color === 'blue' ? 'rgba(59, 130, 246, 0.9)'
                : player.color === 'yellow' ? 'rgba(234, 179, 8, 0.9)'
                : player.color === 'custom' ? 'rgba(139, 92, 246, 0.9)' // Purple for custom
                : 'rgba(55, 65, 81, 0.9)'
            }}
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: player.color === 'custom' ? 'purple' : player.color }}
            />
            <span className="text-xs font-medium">{player.score}</span>
            {player.eliminated && <Skull className="w-3 h-3 ml-1" />}
          </div>
        ))}
      </div>

      {/* Phase announcements */}
      {phase === 'FREEZE' && gameActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="text-5xl font-bold text-red-500 animate-pulse drop-shadow-lg">
            FREEZE!
          </div>
        </div>
      )}

      {phase === 'MOVE' && gameActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="text-5xl font-bold text-green-500 animate-pulse drop-shadow-lg">
            MOVE!
          </div>
        </div>
      )}
      
      {/* Game over announcement */}
      {phase === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold text-white mb-4">
            GAME OVER
          </div>
          
          {winner && (
            <div className="bg-white/90 rounded-lg p-4 shadow-lg">
              <div className="text-center">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-black">
                  {getPlayerColorName(winner)} Wins!
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Score: {players.find(p => p.id === winner)?.score || 0}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Setup instructions */}
      {phase === 'SETUP' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
          <div className="max-w-md mx-auto p-6 bg-white/10 backdrop-blur-sm rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">Players Setup</h2>
            
            <div className="flex justify-center gap-4 mb-6">
              {['red', 'green', 'blue', 'yellow', 'custom'].map(color => (
                <button
                  key={color}
                  className={cn(
                    "w-12 h-12 rounded-full",
                    color !== 'custom' ? `bg-${color}-500` : "bg-purple-500",
                    players.some(p => p.color === color) && "ring-2 ring-white"
                  )}
                  style={{ backgroundColor: color !== 'custom' ? color : 'purple' }}
                  onClick={() => useGameStore.getState().addPlayer(color as any)}
                >
                  {players.some(p => p.color === color) && (
                    <User className="w-6 h-6 text-white mx-auto" />
                  )}
                  {color === 'custom' && !players.some(p => p.color === color) && (
                    <span className="text-xs text-white font-bold">+</span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mb-6">
              <p className="text-center mb-2">Difficulty</p>
              <div className="flex justify-center gap-2">
                {['easy', 'medium', 'hard'].map(level => (
                  <button
                    key={level}
                    className={cn(
                      "px-3 py-1 rounded",
                      level === difficulty ? "bg-white text-black" : "bg-black/30"
                    )}
                    onClick={() => useGameStore.getState().setDifficulty(level as any)}
                  >
                    {difficultyLabels[level as keyof typeof difficultyLabels]}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                className={cn(
                  "px-8 py-3 rounded-lg font-bold text-lg",
                  players.length > 0
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-gray-500 cursor-not-allowed"
                )}
                disabled={players.length === 0}
                onClick={() => useGameStore.getState().startGame()}
              >
                Start Game
              </button>
            </div>
            
            <p className="text-sm text-center mt-4 opacity-80">
              Each player should wear a t-shirt matching their selected color
            </p>
          </div>
        </div>
      )}
    </div>
  );
}