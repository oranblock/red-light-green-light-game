import { create } from 'zustand';

// Game phases
type GamePhase = 'SETUP' | 'MOVE' | 'FREEZE' | 'GAME_OVER';

// Difficulty levels
type DifficultyLevel = 'easy' | 'medium' | 'hard';

// Player colors
export type PlayerColor = 'red' | 'green' | 'blue' | 'yellow';

// Player interface
export interface Player {
  id: string;
  color: PlayerColor | 'custom';
  active: boolean;
  score: number;
  position: {
    x: number;
    y: number;
  };
  lastPosition: {
    x: number;
    y: number;
  };
  eliminated: boolean;
}

interface GameState {
  // Game configuration
  phase: GamePhase;
  difficulty: DifficultyLevel;
  roundTime: number;
  currentRound: number;
  maxRounds: number;
  
  // Camera and detection settings
  cameraReady: boolean;
  detectionThreshold: number;
  customColorValues: [number, number, number];
  
  // Player management
  players: Player[];
  activePlayers: number;
  leadingPlayer: string | null;
  
  // Time tracking
  timerActive: boolean;
  timeRemaining: number;
  freezeDuration: number;
  moveDuration: number;
  
  // Game status
  gameActive: boolean;
  winner: string | null;
  
  // Actions
  setPhase: (phase: GamePhase) => void;
  setDifficulty: (level: DifficultyLevel) => void;
  setCameraReady: (ready: boolean) => void;
  addPlayer: (color: PlayerColor | 'custom') => void;
  removePlayer: (id: string) => void;
  updatePlayerPosition: (id: string, x: number, y: number) => void;
  checkPlayerMovement: () => void;
  eliminatePlayer: (id: string) => void;
  startGame: () => void;
  endGame: () => void;
  startRound: () => void;
  endRound: () => void;
  resetGame: () => void;
  toggleTimer: () => void;
  updateTimer: () => void;
  determineLeader: () => void;
  updateCustomColor: (r: number, g: number, b: number) => void;
}

// Generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Calculate movement between positions
const calculateMovement = (
  current: { x: number; y: number },
  previous: { x: number; y: number }
): number => {
  return Math.sqrt(
    Math.pow(current.x - previous.x, 2) + Math.pow(current.y - previous.y, 2)
  );
};

// Get detection threshold based on difficulty
const getDetectionThreshold = (difficulty: DifficultyLevel): number => {
  switch (difficulty) {
    case 'easy':
      return 50;  // Much more forgiving
    case 'medium':
      return 30;  // Moderate sensitivity
    case 'hard':
      return 15;  // Still challenging but possible
    default:
      return 30;
  }
};

// Get phase durations based on difficulty - SIMPLIFIED FOR DEMO
const getPhaseDurations = (
  difficulty: DifficultyLevel
): { move: number; freeze: number } => {
  // For now, make all phases the same regardless of difficulty
  // This makes the cycle more predictable for testing
  return { move: 5000, freeze: 5000 }; // 5 seconds each for easier testing
};

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  phase: 'SETUP',
  difficulty: 'medium',
  roundTime: 30,
  currentRound: 0,
  maxRounds: 10,
  
  cameraReady: false,
  detectionThreshold: 10,
  customColorValues: [100, 100, 100],
  
  players: [],
  activePlayers: 0,
  leadingPlayer: null,
  
  timerActive: false,
  timeRemaining: 0,
  freezeDuration: 4000,
  moveDuration: 4000,
  
  gameActive: false,
  winner: null,
  
  // Actions
  setPhase: (phase) => set({ phase }),
  
  setDifficulty: (level) => {
    const { move, freeze } = getPhaseDurations(level);
    set({ 
      difficulty: level,
      detectionThreshold: getDetectionThreshold(level),
      moveDuration: move,
      freezeDuration: freeze
    });
  },
  
  setCameraReady: (ready) => set({ cameraReady: ready }),
  
  addPlayer: (color) => {
    const { players } = get();
    
    // Check if color is already taken
    if (players.some(p => p.color === color)) {
      return;
    }
    
    const newPlayer: Player = {
      id: generateId(),
      color,
      active: true,
      score: 0,
      position: { x: 0, y: 0 },
      lastPosition: { x: 0, y: 0 },
      eliminated: false
    };
    
    set({ 
      players: [...players, newPlayer],
      activePlayers: get().activePlayers + 1
    });
  },
  
  removePlayer: (id) => {
    const { players, activePlayers } = get();
    const player = players.find(p => p.id === id);
    
    if (player && player.active) {
      set({ activePlayers: activePlayers - 1 });
    }
    
    set({ players: players.filter(p => p.id !== id) });
    get().determineLeader();
  },
  
  updatePlayerPosition: (id, x, y) => {
    const { players, phase } = get();
    const playerIndex = players.findIndex(p => p.id === id);
    
    if (playerIndex === -1) return;
    
    const updatedPlayers = [...players];
    const currentPlayer = updatedPlayers[playerIndex];
    
    // Make sure we're tracking position properly for movement detection
    if (phase === 'MOVE') {
      // During MOVE phase, continuously update position and keep a reference to the last position
      // Only very occasionally log positions to avoid console spam
      if (Math.random() < 0.001) {
        console.log(`Player ${currentPlayer.color} at position: (${x}, ${y})`);
      }
      
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        position: { x, y },
        // For transition to FREEZE phase, the last recorded position during MOVE is important
        lastPosition: currentPlayer.position
      };
    } else {
      // During non-MOVE phases, just update the current position
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        position: { x, y }
      };
    }
    
    set({ players: updatedPlayers });
  },
  
  checkPlayerMovement: () => {
    // COMPLETELY DISABLED - No elimination or game over
    // This ensures the game will continue cycling through phases
    
    // Just print a log so we know it's being called
    console.log("MOVEMENT CHECK DISABLED: Game will not end");
    
    // Always update the leader board for UI
    get().determineLeader();
  },
  
  eliminatePlayer: (id) => {
    const { players, activePlayers } = get();
    const playerIndex = players.findIndex(p => p.id === id);
    
    if (playerIndex === -1) return;
    
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      eliminated: true,
      active: false
    };
    
    const newActivePlayers = activePlayers - 1;
    
    set({ 
      players: updatedPlayers,
      activePlayers: newActivePlayers
    });
    
    // If only one player remains, end the game
    if (newActivePlayers <= 1) {
      const winner = updatedPlayers.find(p => p.active)?.id || null;
      set({ phase: 'GAME_OVER', winner, gameActive: false });
    }
    
    get().determineLeader();
  },
  
  startGame: () => {
    if (get().players.length < 1) return;
    
    console.log("Starting game in SIMPLIFIED MODE - no eliminations");
    
    // Get the current players with their current positions
    // This preserves tracked positions from SETUP phase
    const currentPlayers = get().players;
    
    const resetPlayers = currentPlayers.map(player => ({
      ...player,
      // Keep current positions intact
      score: 0,
      eliminated: false,
      active: true,
      // Only reset positions if they're at 0,0
      position: player.position.x === 0 && player.position.y === 0 
        ? player.position
        : player.position,
      lastPosition: player.position
    }));
    
    // Get phase durations based on current difficulty
    const { move, freeze } = getPhaseDurations(get().difficulty);
    
    // Always start with the MOVE phase for simplicity
    set({ 
      players: resetPlayers,
      activePlayers: resetPlayers.length,
      winner: null,
      gameActive: true,
      phase: 'MOVE', // Always start with MOVE phase
      currentRound: 1,
      timeRemaining: move,
      timerActive: true
    });
    
    console.log(`Game started in MOVE phase with ${move}ms duration`);
    console.log(`Players will NOT be eliminated - this is a simplified demo`);
    
    get().determineLeader();
  },
  
  endGame: () => {
    set({
      gameActive: false,
      phase: 'GAME_OVER',
      timerActive: false
    });
  },
  
  startRound: () => {
    const { phase } = get();
    
    // Debug log - simplified for clarity
    console.log(`Starting new round, previous phase: ${phase}`);
    
    // ALWAYS toggle between MOVE and FREEZE phases
    // If current phase is FREEZE, next should be MOVE and vice versa
    // If somehow in another phase, default to MOVE
    const newPhase = phase === 'FREEZE' ? 'MOVE' : 'FREEZE';
    
    // Get the appropriate duration based on the phase and difficulty
    const { move, freeze } = getPhaseDurations(get().difficulty);
    const duration = newPhase === 'MOVE' ? move : freeze;
    
    console.log(`Transitioning to ${newPhase} phase with ${duration}ms duration`);
    
    set({
      phase: newPhase,
      timeRemaining: duration,
      timerActive: true
    });
  },
  
  endRound: () => {
    const { currentRound, phase, players, gameActive } = get();
    
    // Safety check - don't proceed if game isn't active
    if (!gameActive) return;
    
    console.log(`Ending round ${currentRound} in ${phase} phase`);
    
    // If in FREEZE phase, check player movement (now disabled)
    if (phase === 'FREEZE') {
      get().checkPlayerMovement();
      
      // Award points to all players - everyone succeeds
      const updatedPlayers = players.map(player => {
        return { ...player, score: player.score + 10 };
      });
      
      set({ players: updatedPlayers });
    }
    
    // Move to next round - but limit to a reasonable number to prevent infinite loops
    // We'll cycle rounds from 1-20 indefinitely
    const nextRound = (currentRound % 20) + 1;
    console.log(`Setting next round to ${nextRound}`);
    
    set({ 
      currentRound: nextRound,
      timerActive: false
    });
    
    // Always determine leader and start next round
    get().determineLeader();
    
    // Start the next round immediately
    console.log("Starting next round immediately");
    get().startRound();
  },
  
  resetGame: () => {
    const { difficulty } = get();
    const { move, freeze } = getPhaseDurations(difficulty);
    
    set({
      phase: 'SETUP',
      currentRound: 0,
      gameActive: false,
      timerActive: false,
      winner: null,
      timeRemaining: 0,
      players: [],
      activePlayers: 0,
      leadingPlayer: null,
      moveDuration: move,
      freezeDuration: freeze
    });
  },
  
  toggleTimer: () => {
    set({ timerActive: !get().timerActive });
  },
  
  updateTimer: () => {
    const { timerActive, timeRemaining, phase, gameActive } = get();
    
    // Only update timer if game is active and timer is running
    if (!timerActive || !gameActive) return;
    
    // Decrement timer by 100ms
    const newTime = Math.max(0, timeRemaining - 100);
    set({ timeRemaining: newTime });
    
    // When timer reaches zero, end the current round
    if (newTime <= 0) {
      // Immediately stop the timer
      set({ timerActive: false });
      
      console.log(`Timer reached zero in ${phase} phase, ending round...`);
      
      // End the round immediately
      get().endRound();
    }
  },
  
  determineLeader: () => {
    const { players } = get();
    
    if (players.length === 0) {
      set({ leadingPlayer: null });
      return;
    }
    
    // Find player with highest score
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const leadingPlayer = sortedPlayers[0].id;
    
    set({ leadingPlayer });
  },
  
  updateCustomColor: (r, g, b) => {
    set({ customColorValues: [r, g, b] });
    
    // Update any existing custom players with the new color values
    const { players } = get();
    if (players.some(p => p.color === 'custom')) {
      console.log(`Updated custom color for tracking: R=${r}, G=${g}, B=${b}`);
    }
  }
}));