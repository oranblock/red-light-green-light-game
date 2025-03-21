import { create } from 'zustand';

// Game phases
type GamePhase = 'SETUP' | 'MOVE' | 'FREEZE' | 'GAME_OVER';

// Difficulty levels
type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'custom';

// Audio elements
const redLightSound = new Audio('/audio/red-light.mp3');
const greenLightSound = new Audio('/audio/green-light.mp3'); 
const afterGreenSound = new Audio('/audio/after-green.mp3');

// Player interface
export interface Player {
  id: string;
  color: string;  // Now just the player ID, no longer using predefined colors
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
  playerColors: Record<string, [number, number, number]>; // Map of player IDs to RGB colors
  
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
  setDetectionThreshold: (threshold: number) => void;
  setCameraReady: (ready: boolean) => void;
  addPlayer: (id: string) => void;
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
  updatePlayerColor: (id: string, r: number, g: number, b: number) => void;
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
    case 'custom':
      return 30;  // Custom difficulty uses direct threshold setting
    default:
      return 30;
  }
};

// Get phase durations based on difficulty
const getPhaseDurations = (
  difficulty: DifficultyLevel
): { move: number; freeze: number } => {
  switch (difficulty) {
    case 'easy':
      return { move: 7000, freeze: 5000 };
    case 'medium':
      return { move: 5000, freeze: 5000 };
    case 'hard':
      return { move: 3000, freeze: 5000 };
    case 'custom':
      // For custom, we'll use the current values in the store
      return { 
        move: useGameStore.getState().moveDuration, 
        freeze: useGameStore.getState().freezeDuration 
      };
    default:
      return { move: 5000, freeze: 5000 };
  }
};

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  phase: 'SETUP',
  difficulty: 'medium',
  roundTime: 30,
  currentRound: 0,
  maxRounds: 10,
  
  cameraReady: false,
  detectionThreshold: 30,
  customColorValues: [200, 50, 50], // Default to a brighter red
  playerColors: {}, // Map of player IDs to RGB colors
  
  players: [],
  activePlayers: 0,
  leadingPlayer: null,
  
  timerActive: false,
  timeRemaining: 0,
  freezeDuration: 5000,
  moveDuration: 5000,
  
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
    
    console.log(`Difficulty set to ${level}, detection threshold: ${getDetectionThreshold(level)}px`);
    console.log(`Phase durations: Move=${move}ms, Freeze=${freeze}ms`);
  },
  
  setDetectionThreshold: (threshold) => {
    set({ detectionThreshold: threshold });
    console.log(`Detection threshold directly set to ${threshold}px`);
  },
  
  setCameraReady: (ready) => set({ cameraReady: ready }),
  
  addPlayer: (id) => {
    const { players, playerColors } = get();
    
    // Check if player with this ID already exists
    if (players.some(p => p.id === id)) {
      console.log(`Player with ID ${id} already exists`);
      return;
    }
    
    const newPlayer: Player = {
      id,
      color: id,  // Use the ID as the color reference
      active: true,
      score: 0,
      position: { x: 0, y: 0 },
      lastPosition: { x: 0, y: 0 },
      eliminated: false
    };
    
    // Generate a default color for the player if none exists
    if (!playerColors[id]) {
      // Default to a red color
      const defaultColor: [number, number, number] = [200, 50, 50];
      set({ 
        playerColors: {
          ...playerColors,
          [id]: defaultColor
        }
      });
    }
    
    console.log(`Added player with ID ${id}`);
    
    set({ 
      players: [...players, newPlayer],
      activePlayers: get().activePlayers + 1
    });
  },
  
  removePlayer: (id) => {
    const { players, activePlayers, playerColors } = get();
    const playerToRemove = players.find(p => p.id === id);
    
    if (!playerToRemove) {
      console.log(`No player with ID ${id} found to remove`);
      return;
    }
    
    // Update active players count if needed
    if (playerToRemove.active) {
      set({ activePlayers: activePlayers - 1 });
    }
    
    // Create a new playerColors object without this player
    const newPlayerColors = { ...playerColors };
    delete newPlayerColors[id];
    
    set({ 
      players: players.filter(p => p.id !== id),
      playerColors: newPlayerColors
    });
    
    console.log(`Removed player with ID ${id}`);
    get().determineLeader();
  },
  
  updatePlayerPosition: (id, x, y) => {
    const { players, phase } = get();
    const playerIndex = players.findIndex(p => p.id === id);
    
    if (playerIndex === -1) return;
    
    const updatedPlayers = [...players];
    const currentPlayer = updatedPlayers[playerIndex];
    
    // Update positions differently based on phase
    if (phase === 'MOVE') {
      // During MOVE phase, continuously update position and last position
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        position: { x, y },
        // Save last position for movement detection in FREEZE phase
        lastPosition: currentPlayer.position
      };
    } else if (phase === 'FREEZE') {
      // During FREEZE, only update current position (for UI feedback)
      // but preserve lastPosition from end of MOVE phase
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        position: { x, y }
      };
    } else {
      // During other phases (SETUP, etc.), just update position
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        position: { x, y },
        lastPosition: { x, y }  // Keep them in sync
      };
    }
    
    set({ players: updatedPlayers });
  },
  
  checkPlayerMovement: () => {
    // Only do movement checking when in FREEZE phase
    if (get().phase !== 'FREEZE') return;
    
    const { players, detectionThreshold } = get();
    const updatedPlayers = [...players];
    let anyEliminated = false;
    
    // Check movement for each player
    updatedPlayers.forEach((player, index) => {
      if (!player.active || player.eliminated) return;
      
      // Calculate movement since freeze started
      const movement = calculateMovement(player.position, player.lastPosition);
      
      // Log movement amount occasionally (every ~20 frames)
      if (Math.random() < 0.05) {
        console.log(`Player ${player.id} moved ${movement.toFixed(1)}px (threshold: ${detectionThreshold}px)`);
      }
      
      // Eliminate player if they moved too much
      if (movement > detectionThreshold) {
        console.log(`Eliminating player ${player.id} for moving ${movement.toFixed(1)}px (threshold: ${detectionThreshold}px)`);
        updatedPlayers[index] = {
          ...player,
          eliminated: true
        };
        anyEliminated = true;
      }
    });
    
    // Update players state if any were eliminated
    if (anyEliminated) {
      set({ 
        players: updatedPlayers,
        activePlayers: updatedPlayers.filter(p => p.active && !p.eliminated).length
      });
      
      // Check for game over (one or fewer players remaining)
      const remainingPlayers = updatedPlayers.filter(p => p.active && !p.eliminated);
      if (remainingPlayers.length <= 1) {
        console.log("Game over triggered by eliminations");
        get().endGame();
      }
    }
    
    // Always update the leaderboard
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
      const winner = updatedPlayers.find(p => p.active && !p.eliminated)?.id || null;
      set({ phase: 'GAME_OVER', winner, gameActive: false });
    }
    
    get().determineLeader();
  },
  
  startGame: () => {
    const { players } = get();
    
    if (players.length < 1) {
      console.log("Can't start game without players");
      return;
    }
    
    console.log("Starting game");
    
    // Preserve any positions that were detected during setup
    // This is key to maintaining tracking during phase transitions
    const gamePlayers = players.map(player => ({
      ...player,
      score: 0,
      eliminated: false,
      active: true
    }));
    
    // Get phase durations based on current difficulty
    const { move, freeze } = getPhaseDurations(get().difficulty);
    
    // Start in MOVE phase
    set({ 
      players: gamePlayers,
      activePlayers: gamePlayers.length,
      winner: null,
      gameActive: true,
      phase: 'MOVE',
      currentRound: 1,
      timeRemaining: move,
      timerActive: true
    });
    
    console.log(`Game started with ${gamePlayers.length} players in MOVE phase`);
    console.log(`Movement threshold: ${get().detectionThreshold}px`);
    
    get().determineLeader();
  },
  
  endGame: () => {
    console.log("Ending game");
    
    // Award points to survivors
    const { players } = get();
    const updatedPlayers = players.map(player => 
      player.eliminated ? player : { ...player, score: player.score + 10 }
    );
    
    // Stop all audio when game ends
    redLightSound.pause();
    redLightSound.currentTime = 0;
    greenLightSound.pause();
    greenLightSound.currentTime = 0;
    afterGreenSound.pause();
    afterGreenSound.currentTime = 0;
    
    set({
      gameActive: false,
      phase: 'GAME_OVER',
      timerActive: false,
      players: updatedPlayers
    });
    
    // Determine final winner
    get().determineLeader();
  },
  
  startRound: () => {
    const { phase } = get();
    
    // Toggle between MOVE and FREEZE phases
    const newPhase = phase === 'FREEZE' ? 'MOVE' : 'FREEZE';
    
    // Get appropriate duration based on the new phase
    const { move, freeze } = getPhaseDurations(get().difficulty);
    const duration = newPhase === 'MOVE' ? move : freeze;
    
    console.log(`Starting new round in ${newPhase} phase (${duration}ms)`);
    
    // Play appropriate sound based on phase transition
    if (newPhase === 'MOVE') {
      // Play green light sound
      greenLightSound.play();
      
      // Start playing the after-green sound that continues during the MOVE phase
      setTimeout(() => {
        afterGreenSound.play();
      }, 1000); // Start after a short delay
    } else {
      // Stop green light sound if it's still playing
      greenLightSound.pause();
      greenLightSound.currentTime = 0;
      
      // Stop after-green sound when red light comes
      afterGreenSound.pause();
      afterGreenSound.currentTime = 0;
      
      // Play red light sound
      redLightSound.play();
    }
    
    set({
      phase: newPhase,
      timeRemaining: duration,
      timerActive: true
    });
  },
  
  endRound: () => {
    const { phase } = get();
    
    console.log(`Ending round in ${phase} phase`);
    
    // If in FREEZE phase, check player movement
    if (phase === 'FREEZE') {
      get().checkPlayerMovement();
      
      // Award points to survivors
      const updatedPlayers = get().players.map(player => {
        if (player.eliminated) return player;
        return { ...player, score: player.score + 5 };
      });
      
      set({ players: updatedPlayers });
    }
    
    // Update round counter (cycle between 1-20)
    const nextRound = (get().currentRound % 20) + 1;
    
    set({ 
      currentRound: nextRound,
      timerActive: false
    });
    
    // Start the next round immediately
    get().startRound();
  },
  
  resetGame: () => {
    console.log("Resetting game");
    
    // Keep existing players but reset their state
    const { players, playerColors } = get();
    const resetPlayers = players.map(player => ({
      ...player,
      score: 0,
      position: { x: 0, y: 0 },
      lastPosition: { x: 0, y: 0 },
      eliminated: false,
      active: true
    }));
    
    // Stop all audio when resetting game
    redLightSound.pause();
    redLightSound.currentTime = 0;
    greenLightSound.pause();
    greenLightSound.currentTime = 0;
    afterGreenSound.pause();
    afterGreenSound.currentTime = 0;
    
    set({
      phase: 'SETUP',
      currentRound: 0,
      gameActive: false,
      timerActive: false,
      winner: null,
      timeRemaining: 0,
      players: resetPlayers,
      activePlayers: resetPlayers.length,
      leadingPlayer: null,
      // Keep the player colors so they're consistent across games
      playerColors
    });
  },
  
  toggleTimer: () => {
    set({ timerActive: !get().timerActive });
  },
  
  updateTimer: () => {
    const { timerActive, timeRemaining, gameActive } = get();
    
    // Only update timer if game is active and timer is running
    if (!timerActive || !gameActive) return;
    
    // Decrement timer by 100ms
    const newTime = Math.max(0, timeRemaining - 100);
    set({ timeRemaining: newTime });
    
    // When timer reaches zero, end the current round
    if (newTime <= 0) {
      // Stop the timer immediately
      set({ timerActive: false });
      
      // End this round and start the next one
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
    console.log(`Updated custom color: RGB(${r}, ${g}, ${b})`);
  },
  
  updatePlayerColor: (id, r, g, b) => {
    const { playerColors } = get();
    
    set({ 
      playerColors: {
        ...playerColors,
        [id]: [r, g, b]
      }
    });
    
    console.log(`Updated color for player ${id}: RGB(${r}, ${g}, ${b})`);
  }
}));