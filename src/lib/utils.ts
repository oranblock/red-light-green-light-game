import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a random number between min and max (inclusive)
 */
export function generateRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates the amount of motion between two video frames
 * 
 * @param previousFrame - ImageData from the previous frame
 * @param currentFrame - ImageData from the current frame
 * @param sensitivity - Threshold for determining significant motion (lower = more sensitive)
 * @returns boolean - true if motion detected exceeds the sensitivity threshold
 */
export function calculateMotion(
  previousFrame: ImageData,
  currentFrame: ImageData,
  sensitivity: number = 30
): boolean {
  const length = previousFrame.data.length;
  let totalDifference = 0;

  // Sample pixels to improve performance (process every 4th pixel)
  const sampleStep = 16; // Only process 1/16th of the pixels

  for (let i = 0; i < length; i += sampleStep) {
    const rDiff = Math.abs(previousFrame.data[i] - currentFrame.data[i]);
    const gDiff = Math.abs(previousFrame.data[i + 1] - currentFrame.data[i + 1]);
    const bDiff = Math.abs(previousFrame.data[i + 2] - currentFrame.data[i + 2]);
    
    // Average the color channel differences
    totalDifference += (rDiff + gDiff + bDiff) / 3;
  }

  // Calculate average difference across all sampled pixels
  const pixelCount = length / (4 * sampleStep);
  const averageDifference = totalDifference / pixelCount;

  // Debug info (uncomment for testing)
  // console.log(`Average difference: ${averageDifference.toFixed(2)}, Threshold: ${sensitivity}`);
  
  return averageDifference > sensitivity;
}

/**
 * Detect the color of a player from an image
 * 
 * @param imageData - ImageData from the video frame
 * @param colorRange - Color range to detect (in RGB ranges)
 * @returns Position of detected color centroid {x, y} or null if not found
 */
export function detectPlayerColor(
  imageData: ImageData, 
  colorRange: {
    red: [number, number, number],
    green: [number, number, number],
    blue: [number, number, number],
    yellow: [number, number, number],
    custom: [number, number, number]
  }, 
  playerColor: 'red' | 'green' | 'blue' | 'yellow' | 'custom'
): { x: number, y: number } | null {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  let matchingPixels = 0;
  let totalX = 0;
  let totalY = 0;
  
  // Get the specific color range based on the player color
  const [redRange, greenRange, blueRange] = colorRange[playerColor];
  
  // Sample every Nth pixel for better performance
  const sampleStep = 8;
  
  // For custom color tracking
  let customR, customG, customB, colorThreshold;
  if (playerColor === 'custom') {
    customR = colorRange.custom[0];
    customG = colorRange.custom[1];
    customB = colorRange.custom[2];
    colorThreshold = 75; // Increased threshold for better detection
    
    // Log custom color values for debugging
    if (Math.random() < 0.01) { // Only log occasionally to avoid spamming
      console.log(`Looking for color: R=${customR}, G=${customG}, B=${customB}, threshold=${colorThreshold}`);
    }
  }
  
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      
      // Check if pixel is within the player's color range
      let isMatch = false;
      
      switch (playerColor) {
        case 'red':
          // Looking for high red, low green/blue
          isMatch = (r > 150) && (g < 100) && (b < 100);
          break;
        case 'green':
          // Looking for high green, low red/blue
          isMatch = (r < 100) && (g > 150) && (b < 100);
          break;
        case 'blue':
          // Looking for high blue, low red/green
          isMatch = (r < 100) && (g < 100) && (b > 150);
          break;
        case 'yellow':
          // Looking for high red+green, low blue
          isMatch = (r > 150) && (g > 150) && (b < 100);
          break;
        case 'custom':
          // For custom color, calculate HSV-like color similarity
          // This is more robust than simple RGB distance
          
          // Calculate color similarity (Euclidean distance in RGB space)
          const colorDiff = Math.sqrt(
            Math.pow(r - customR, 2) +
            Math.pow(g - customG, 2) +
            Math.pow(b - customB, 2)
          );
          
          // Consider a match if the color is within a certain threshold
          isMatch = colorDiff < colorThreshold;
          break;
      }
      
      if (isMatch) {
        totalX += x;
        totalY += y;
        matchingPixels++;
      }
    }
  }
  
  // If we found enough matching pixels, calculate the centroid
  const minPixelsRequired = 5; // Reduced from 10 to make detection more sensitive
  
  if (matchingPixels >= minPixelsRequired) {
    // Occasionally log for debugging
    if (Math.random() < 0.01) {
      console.log(`Detected ${playerColor} color: ${matchingPixels} matching pixels`);
    }
    
    return {
      x: totalX / matchingPixels,
      y: totalY / matchingPixels
    };
  }
  
  return null;
}

/**
 * Get default color ranges for player detection
 * These values may need adjustment based on lighting conditions
 */
export function getDefaultColorRanges() {
  return {
    red: [120, 70, 70],     // High R, Low G, Low B
    green: [70, 120, 70],   // Low R, High G, Low B
    blue: [70, 70, 120],    // Low R, Low G, High B
    yellow: [120, 120, 70],  // High R, High G, Low B
    custom: [100, 100, 100]  // Custom color (will be updated by capture)
  };
}

/**
 * Capture a color from the canvas at a specific position
 * Returns the average RGB values for the area around the position
 */
export function captureColorAt(
  imageData: ImageData,
  x: number,
  y: number,
  sampleSize: number = 10
): [number, number, number] {
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
}

/**
 * Calculate the distance between two points
 */
export function calculateDistance(p1: {x: number, y: number}, p2: {x: number, y: number}): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}