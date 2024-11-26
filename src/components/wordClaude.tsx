import React, { useState, useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Core interfaces for word cloud data
export interface WordCloudWord {
  text: string;
  value: number;
  color?: string;
}

interface ProcessedWord extends WordCloudWord {
  x: number;
  y: number;
  fontSize: number;
  rotation: number;
  width: number;
  height: number;
}

// Enhanced interfaces for more granular font size control
export interface FontSizeConfig {
  min: number;          // Minimum font size as % of container
  max: number;          // Maximum font size as % of container
  scaleFactor?: number; // Optional multiplier for overall font scaling
  wordCountScaling?: {  // Optional configuration for word count based scaling
    enabled: boolean;   // Whether to apply word count scaling
    minScale: number;   // Minimum scale factor (default 0.5)
    maxScale: number;   // Maximum scale factor (default 2.0)
    threshold: number;  // Word count threshold for scaling (default 50)
  };
}

type ScaleType = "linear" | "logarithmic";

interface WordCloudProps {
  words: WordCloudWord[];
  width?: number;
  height?: number;
  fontConfig?: FontSizeConfig;
  scaleType?: ScaleType;
  debug?: boolean;
  onWordClick?: (word: WordCloudWord) => void;
}

// Geometry interfaces
interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  points: Point[];
}

// Constants
const MIN_DIMENSION = 100; // Minimum size to render
const DEFAULT_FONT_CONFIG: FontSizeConfig = {
  min: 3,
  max: 15,
  scaleFactor: 1,
  wordCountScaling: {
    enabled: true,
    minScale: 0.5,
    maxScale: 2.0,
    threshold: 50
  }
};

/**
 * Enhanced font size calculation system with better customization and scaling
 */
const calculateFontSize = (
  containerSize: { width: number; height: number },
  words: WordCloudWord[],
  fontConfig: FontSizeConfig,
  normalizedValue: number
): number => {
  // Get the smaller container dimension as reference
  const referenceSize = Math.min(containerSize.width, containerSize.height);
  
  // Calculate base size range
  const minSize = (fontConfig.min / 100) * referenceSize;
  const maxSize = (fontConfig.max / 100) * referenceSize;
  
  // Linear interpolation between min and max based on normalized value
  let fontSize = minSize + (maxSize - minSize) * normalizedValue;
  
  // Apply word count scaling if enabled
  if (fontConfig.wordCountScaling?.enabled) {
    const { minScale, maxScale, threshold } = fontConfig.wordCountScaling;
    const wordCount = words.length;
    
    // Logarithmic scaling based on word count
    const scaleFactor = wordCount <= threshold
      ? maxScale
      : Math.max(minScale, maxScale * (Math.log(threshold) / Math.log(wordCount)));
    
    fontSize *= scaleFactor;
  }
  
  // Apply global scale factor
  if (fontConfig.scaleFactor) {
    fontSize *= fontConfig.scaleFactor;
  }
  
  // Prevent extreme sizes
  const absoluteMin = 8; // Ensure text remains readable
  const absoluteMax = referenceSize * 0.8; // Prevent text from being larger than container
  
  return Math.min(Math.max(fontSize, absoluteMin), absoluteMax);
};

/**
 * Normalizes values for font sizing using either linear or logarithmic scale
 */
const normalizeValue = (
  value: number,
  minValue: number,
  maxValue: number,
  scaleType: ScaleType
): number => {
  if (minValue === maxValue) return 0.5;
  if (value <= 0) return 0;

  const epsilon = 0.000001;

  if (scaleType === "logarithmic") {
    const minLog = Math.log(Math.max(epsilon, minValue));
    const maxLog = Math.log(Math.max(epsilon, maxValue));
    const valueLog = Math.log(Math.max(epsilon, value));
    return (valueLog - minLog) / (maxLog - minLog);
  }

  return (value - minValue) / (maxValue - minValue);
};

/**
 * Calculates the rotated bounding box for a word based on its dimensions and rotation
 */
const getRotatedBoundingBox = (
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotation: number
): BoundingBox => {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // Add padding around words for better spacing
  const padding = Math.max(width, height) * 0.15;
  width += padding;
  height += padding;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const corners: Point[] = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return {
    points: corners.map((corner) => ({
      x: centerX + (corner.x * cos - corner.y * sin),
      y: centerY + (corner.x * sin + corner.y * cos),
    })),
  };
};
/**
 * A responsive word cloud component that displays words with size based on their values
 * and positions them using a spiral algorithm to avoid overlapping.
 */
const WordCloud: React.FC<WordCloudProps> = ({
    words,
    width: providedWidth,
    height: providedHeight,
    fontConfig = DEFAULT_FONT_CONFIG,
    scaleType = "linear",
    debug = false,
    onWordClick,
  }) => {
    // Component state
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: MIN_DIMENSION, height: MIN_DIMENSION });
    const [showDebug, setShowDebug] = useState(debug);
    const [isAnimating, setIsAnimating] = useState(true);
    const [placementAttempts, setPlacementAttempts] = useState<{ [key: string]: number }>({});
    const [processedWords, setProcessedWords] = useState<ProcessedWord[]>([]);
    const [wordCount, setWordCount] = useState({ placed: 0, total: 0 });
  
    // Use provided dimensions or measured dimensions
    const width = providedWidth ?? dimensions.width;
    const height = providedHeight ?? dimensions.height;
  
    /**
     * Determines if two line segments intersect
     */
    const doLineSegmentsIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
      const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
      if (denominator === 0) return false;
  
      const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
      const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;
  
      return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    };
  
    /**
     * Checks if two bounding boxes intersect
     */
    const checkBoundingBoxesIntersect = (box1: BoundingBox, box2: BoundingBox): boolean => {
      // Check if one box is completely inside the other
      const isPointInsideBox = (point: Point, box: BoundingBox): boolean => {
        let inside = false;
        for (let i = 0, j = box.points.length - 1; i < box.points.length; j = i++) {
          const xi = box.points[i].x;
          const yi = box.points[i].y;
          const xj = box.points[j].x;
          const yj = box.points[j].y;
  
          const intersect =
            yi > point.y !== yj > point.y && 
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
          if (intersect) inside = !inside;
        }
        return inside;
      };
  
      // Check all line segment intersections
      for (let i = 0; i < box1.points.length; i++) {
        const p1 = box1.points[i];
        const p2 = box1.points[(i + 1) % box1.points.length];
  
        for (let j = 0; j < box2.points.length; j++) {
          const p3 = box2.points[j];
          const p4 = box2.points[(j + 1) % box2.points.length];
  
          if (doLineSegmentsIntersect(p1, p2, p3, p4)) {
            return true;
          }
        }
      }
  
      return isPointInsideBox(box1.points[0], box2) || isPointInsideBox(box2.points[0], box1);
    };
  
    /**
     * Calculates position along a spiral based on attempt number and word importance
     */
    const getSpiralPosition = (
      attempt: number,
      maxAttempts: number,
      normalizedValue: number
    ): { x: number; y: number; rotation: number } => {
      const t = attempt / maxAttempts;
      const angle = t * 2 * Math.PI * 12;
  
      // Adjust spiral growth based on word importance
      const spiralGrowth = 1 + t * (2 - normalizedValue);
      const initialRadius = Math.min(width, height) * 0.1;
      const radius = initialRadius + t * Math.min(width, height) * 0.45 * spiralGrowth;
  
      // Randomly choose horizontal or vertical orientation
      const rotation = Math.random() > 0.5 ? 0 : 90;
  
      return {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        rotation,
      };
    };
  
    /**
     * Process words when input changes or container size changes
     */
    const processWords = (inputWords: WordCloudWord[]): {
      words: ProcessedWord[];
      attempts: { [key: string]: number };
    } => {
      const placedWords: ProcessedWord[] = [];
      const newPlacementAttempts: { [key: string]: number } = {};
      const tempCanvas = document.createElement("canvas");
      const ctx = tempCanvas.getContext("2d");
  
      if (!ctx) return { words: [], attempts: {} };
  
      // Sort words by value for consistent layout
      const sortedWords = [...inputWords].sort((a, b) => b.value - a.value);
      const maxValue = Math.max(...sortedWords.map((w) => w.value));
      const minValue = Math.min(...sortedWords.map((w) => w.value));
  
      let placedCount = 0;
      const totalWords = sortedWords.length;
      const containerSize = { width, height };
  
      sortedWords.forEach((word) => {
        const normalizedValue = normalizeValue(word.value, minValue, maxValue, scaleType);
        const fontSize = calculateFontSize(containerSize, sortedWords, fontConfig, normalizedValue);
        
        // Measure text dimensions
        ctx.font = `${fontSize}px Arial`;
        const metrics = ctx.measureText(word.text);
        const wordWidth = metrics.width;
        const wordHeight = fontSize;
  
        let placed = false;
        let attempts = 0;
        const maxAttempts = 300;
  
        while (!placed && attempts < maxAttempts) {
          const { x, y, rotation } = getSpiralPosition(attempts, maxAttempts, normalizedValue);
          const newWordBox = getRotatedBoundingBox(x, y, wordWidth, wordHeight, rotation);
  
          // Check for overlaps with already placed words
          const hasOverlap = placedWords.some((placedWord) => {
            const placedWordBox = getRotatedBoundingBox(
              placedWord.x,
              placedWord.y,
              placedWord.width,
              placedWord.height,
              placedWord.rotation
            );
            return checkBoundingBoxesIntersect(newWordBox, placedWordBox);
          });
  
          // Check if word is within bounds with margin
          const marginPercent = 0.05;
          const margin = Math.min(width, height) * marginPercent;
          const inBounds = newWordBox.points.every(
            (point) =>
              point.x >= margin && 
              point.x <= width - margin && 
              point.y >= margin && 
              point.y <= height - margin
          );
  
          if (!hasOverlap && inBounds) {
            placedWords.push({
              ...word,
              x,
              y,
              fontSize,
              rotation,
              width: wordWidth,
              height: wordHeight,
            });
            placed = true;
            placedCount++;
          }
  
          attempts++;
        }
  
        newPlacementAttempts[word.text] = attempts;
      });
  
      setWordCount({ placed: placedCount, total: totalWords });
      return { words: placedWords, attempts: newPlacementAttempts };
    };
  
    // Update dimensions when container size changes
    useEffect(() => {
      if (!containerRef.current) return;
  
      const updateDimensions = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const newWidth = Math.max(rect.width, MIN_DIMENSION);
          const newHeight = Math.max(rect.height, MIN_DIMENSION);
  
          if (Math.abs(newWidth - dimensions.width) > 1 || Math.abs(newHeight - dimensions.height) > 1) {
            setDimensions({ width: newWidth, height: newHeight });
          }
        }
      };
  
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(updateDimensions);
      });
  
      updateDimensions();
      resizeObserver.observe(containerRef.current);
  
      return () => resizeObserver.disconnect();
    }, [dimensions.width, dimensions.height]);
  
    // Process words when relevant props change
    useEffect(() => {
      if (width && height) {
        const result = processWords(words);
        setProcessedWords(result.words);
        setPlacementAttempts(result.attempts);
      }
    }, [words, width, height, fontConfig, scaleType]);
  
    // Handle animation timing
    useEffect(() => {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 100);
      return () => clearTimeout(timer);
    }, [words, width, height]);
  
    return (
      <div ref={containerRef} className="absolute inset-0 w-full h-full">
        <TooltipProvider>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full border border-solid border-gray-200"
            preserveAspectRatio="xMidYMid meet"
          >
            {processedWords.map((word, index) => {
              const dx = word.x - width / 2;
              const dy = word.y - height / 2;
              const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
              const maxDistance = Math.sqrt(width * width + height * height) / 2;
              const normalizedDistance = distanceFromCenter / maxDistance;
              const normalizedValue = word.value / Math.max(...words.map((w) => w.value));
              const delay = normalizedDistance * 500 + (1 - normalizedValue) * 200;
  
              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <g
                      style={{
                        transform: isAnimating ? "scale(0)" : "scale(1)",
                        transformOrigin: "center",
                        transition: `transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, 
                                  opacity 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
                        opacity: isAnimating ? 0 : 1,
                      }}
                    >
                      <g
                        transform={`translate(${isAnimating ? width / 2 : word.x},${
                          isAnimating ? height / 2 : word.y
                        })`}
                        style={{
                          transition: `transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
                        }}
                      >
                        <g transform={`rotate(${word.rotation})`}>
                          <text
                            fontSize={word.fontSize}
                            fill={word.color || `hsl(${(index * 30) % 360}, 70%, 50%)`}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="cursor-pointer transition-all duration-150 opacity-90 hover:opacity-100 hover:font-bold"
                            onClick={() => onWordClick?.(word)}
                          >
                            {word.text}
                          </text>
                          {showDebug && (
                            <rect
                              x={-word.width / 2}
                              y={-word.height / 2}
                              width={word.width}
                              height={word.height}
                              fill="none"
                              stroke="red"
                              strokeWidth="1"
                              style={{ pointerEvents: "none" }}
                            />
                          )}
                        </g>
                      </g>
                    </g>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white border shadow-lg p-3">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-black">{word.text}</div>
                      <div className="text-sm text-gray-600">
                        Value: {word.value.toLocaleString()}
                        {debug && ` (${placementAttempts[word.text]} attempts)`}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </svg>
        </TooltipProvider>
        {debug && (
          <>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="absolute top-2 left-2 px-3 py-1 bg-white border rounded shadow hover:bg-gray-50"
            >
              Toggle Debug View
            </button>
            <div className="absolute top-2 right-2 px-3 py-1 bg-white border rounded shadow">
              {wordCount.placed}/{wordCount.total} words shown
            </div>
            <div className="absolute bottom-2 right-2 px-3 py-1 bg-white border rounded shadow text-sm">
              <div>Font Range: {fontConfig.min}% - {fontConfig.max}%</div>
              <div>Scale: {fontConfig.scaleFactor ?? 1}x</div>
              <div>Word Scaling: {fontConfig.wordCountScaling?.enabled ? 'On' : 'Off'}</div>
            </div>
          </>
        )}
      </div>
    );
  };
  
  export default WordCloud;