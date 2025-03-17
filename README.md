# Red Light, Green Light Game

A browser-based implementation of the classic "Red Light, Green Light" game using React, TypeScript, and webcam-based motion detection.

![Red Light, Green Light Game](https://github.com/oranblock/red-light-green-light-game/raw/main/public/game-screenshot.png)

## Overview

This web application brings the popular children's game "Red Light, Green Light" to your browser with real-time motion detection. Players must freeze when the light is red and can only move when the light is green. The game uses your device's camera to track colored objects (like colored shirts or objects) and detect movement.

## Features

- **Camera-Based Motion Detection**: Track players using colored objects
- **Multi-Player Support**: Track up to 4 different colored objects simultaneously
- **Custom Color Tracking**: Calibrate the game to track any color
- **Adjustable Difficulty Levels**: Easy, Medium, and Hard modes with different sensitivities
- **Visual Feedback**: Clear visual indicators for "Red Light" and "Green Light" phases
- **Score Tracking**: Keeps track of player scores and identifies the winner
- **Responsive Design**: Works on both desktop and mobile devices

## Technologies Used

- React 18
- TypeScript
- Zustand (for state management)
- Tailwind CSS (for styling)
- HTML5 Canvas API (for motion detection)
- MediaDevices API (for camera access)

## How to Play

1. **Setup**: Allow camera access when prompted
2. **Select Players**: Choose colors for each player (red, green, blue, yellow, or custom)
3. **Select Difficulty**: Choose Easy, Medium, or Hard
4. **Start Game**: Click "Start Game" to begin
5. **Gameplay**:
   - When "MOVE" appears with a green border, players can move freely
   - When "FREEZE" appears with a red border, players must remain still
   - Players who move during "FREEZE" will be eliminated
6. **Winning**: The last player remaining wins!

## Development Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/oranblock/red-light-green-light-game.git
   cd red-light-green-light
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Building for Production

```
npm run build
```

This will create a `dist` folder with optimized production build.

## Configuration Options

The game offers several configuration options in the settings menu:

- **Camera**: Enable/disable camera
- **Color Tracking**: Enable/disable color detection
- **Debug Mode**: View detailed logs for debugging
- **Elimination**: Enable/disable player elimination
- **Phase Duration**: Adjust how long each phase lasts
- **Movement Threshold**: Set sensitivity for motion detection
- **Camera Selection**: Choose between front/back cameras

## Implementation Details

### Color Detection

The game uses a color detection algorithm that:
1. Captures video frames from the camera
2. Analyzes the RGB values of pixels
3. Identifies regions matching target colors
4. Calculates the centroid of matching color regions
5. Tracks the movement of these centroids between frames

### Motion Detection

During "FREEZE" phases, the game detects motion by:
1. Comparing the current position of each player with their last recorded position
2. Calculating the Euclidean distance between these positions
3. Comparing the distance against a threshold (based on difficulty level)
4. Eliminating players who exceed the movement threshold

## Browser Compatibility

The game works best in modern browsers with WebRTC support:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT

## Acknowledgements

- Developed as a fun demonstration of webcam-based motion detection
- Inspired by the classic children's game and its various adaptations