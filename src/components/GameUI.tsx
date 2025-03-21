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
    <div className={`fixed top-0 left-0 right-0 bottom-0 w-full h-full ${gameActive ? 'z-50' : ''}`}>
      <div className="flex justify-between items-center p-4">
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
          <div className="text-8xl font-bold text-red-500 animate-pulse drop-shadow-lg">
            FREEZE!
          </div>
        </div>
      )}

      {phase === 'MOVE' && gameActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="text-8xl font-bold text-green-500 animate-pulse drop-shadow-lg">
            MOVE!
          </div>
        </div>
      )}
      
      {/* Game over announcement */}
      {phase === 'GAME_OVER' && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <div className="text-6xl font-bold text-white mb-6 animate-pulse">
            GAME OVER
          </div>
          
          {winner && (
            <div className="bg-white/90 rounded-lg p-6 shadow-xl">
              <div className="text-center">
                <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                <div className="text-4xl font-bold text-black">
                  {getPlayerColorName(winner)} Wins!
                </div>
                <div className="text-xl text-gray-600 mt-2">
                  Score: {players.find(p => p.id === winner)?.score || 0}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Setup instructions */}
      {phase === 'SETUP' && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-50">
          <div className="max-w-xl mx-auto p-8 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl">
            <h2 className="text-3xl font-bold mb-6 text-center">Players Setup</h2>
            
            <div className="flex justify-center gap-6 mb-8">
              {['red', 'green', 'blue', 'yellow', 'custom'].map(color => (
                <button
                  key={color}
                  className={cn(
                    "w-16 h-16 rounded-full shadow-lg transition-all transform hover:scale-110",
                    color !== 'custom' ? `bg-${color}-500` : "bg-purple-500",
                    players.some(p => p.color === color) && "ring-4 ring-white"
                  )}
                  style={{ backgroundColor: color !== 'custom' ? color : 'purple' }}
                  onClick={() => useGameStore.getState().addPlayer(color)}
                >
                  {players.some(p => p.color === color) && (
                    <User className="w-8 h-8 text-white mx-auto" />
                  )}
                  {color === 'custom' && !players.some(p => p.color === color) && (
                    <span className="text-lg text-white font-bold">+</span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mb-8">
              <p className="text-center text-xl mb-4">Select Difficulty</p>
              <div className="flex justify-center gap-4">
                {['easy', 'medium', 'hard'].map(level => (
                  <button
                    key={level}
                    className={cn(
                      "px-6 py-3 rounded-xl font-bold text-lg transition-all transform hover:scale-105",
                      level === difficulty 
                        ? level === 'easy' ? "bg-green-500 text-white shadow-lg" 
                        : level === 'medium' ? "bg-yellow-500 text-white shadow-lg"
                        : "bg-red-500 text-white shadow-lg"
                        : "bg-black/30 hover:bg-black/50"
                    )}
                    onClick={() => useGameStore.getState().setDifficulty(level as 'easy' | 'medium' | 'hard' | 'custom')}
                  >
                    {difficultyLabels[level as keyof typeof difficultyLabels]}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                className={cn(
                  "px-12 py-4 rounded-xl font-bold text-2xl shadow-lg transition-all transform hover:scale-105",
                  players.length > 0
                    ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
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