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
  boundingBox?: BoundingBox;
}

// Configuration interfaces
export interface FontSizeConfig {
  min: number; // Minimum font size as % of container
  max: number; // Maximum font size as % of container
  scaleFactor?: number; // Optional multiplier for overall font scaling
  wordCountScaling?: {
    // Optional configuration for word count based scaling
    enabled: boolean; // Whether to apply word count scaling
    minScale: number; // Minimum scale factor (default 0.5)
    maxScale: number; // Maximum scale factor (default 2.0)
    threshold: number; // Word count threshold for scaling (default 50)
  };
}

export interface PackingConfig {
  factor: number; // Controls how tightly words are packed (0.5 to 2.0)
  strategy: "uniform" | "adaptive"; // Uniform applies same padding, adaptive varies by word size
  minSpacing: number; // Minimum pixels between words
  bruteForce: boolean; // If true, tries multiple rotations for better fits
  maxAttempts?: number; // Maximum placement attempts per word
  spiralDensity?: number; // Controls density of spiral pattern
}

interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  points: Point[];
}

interface WordCloudProps {
  words: WordCloudWord[];
  width?: number;
  height?: number;
  fontConfig?: FontSizeConfig;
  packingConfig?: PackingConfig;
  scaleType?: ScaleType;
  debug?: boolean;
  rotationMode?: "any" | "orthogonal";
  onWordClick?: (word: WordCloudWord) => void;
}

type ScaleType = "linear" | "logarithmic";

// Constants and default configurations
const MIN_DIMENSION = 100; // Minimum size to render

const DEFAULT_FONT_CONFIG: FontSizeConfig = {
  min: 3,
  max: 15,
  scaleFactor: 1,
  wordCountScaling: {
    enabled: true,
    minScale: 0.5,
    maxScale: 2.0,
    threshold: 50,
  },
};

const DEFAULT_PACKING_CONFIG: PackingConfig = {
  factor: 1.0,
  strategy: "adaptive",
  minSpacing: 2,
  bruteForce: true,
  maxAttempts: 500,
  spiralDensity: 12,
};

/**
 * Enhanced font size calculation with better customization and scaling
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
    const scaleFactor =
      wordCount <= threshold
        ? maxScale
        : Math.max(minScale, maxScale * (Math.log(threshold) / Math.log(wordCount)));

    fontSize *= scaleFactor;
  }

  // Apply global scale factor
  if (fontConfig.scaleFactor) {
    fontSize *= fontConfig.scaleFactor;
  }

  // Prevent extreme sizes
  const absoluteMin = 8;
  const absoluteMax = referenceSize * 0.8;

  return Math.min(Math.max(fontSize, absoluteMin), absoluteMax);
};

/**
 * Normalizes values for font sizing using either linear or logarithmic scale
 */
const normalizeValue = (value: number, minValue: number, maxValue: number, scaleType: ScaleType): number => {
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
 * Determines word spacing based on packing configuration and word importance
 */
const getWordSpacing = (
  word: ProcessedWord,
  packingConfig: PackingConfig,
  normalizedValue: number
): number => {
  const baseSpacing = Math.max(packingConfig.minSpacing, Math.min(word.width, word.height) * 0.15);

  if (packingConfig.strategy === "uniform") {
    return baseSpacing * packingConfig.factor;
  }

  // Adaptive strategy: important words get more space
  const importanceFactor = 0.5 + normalizedValue * 0.5;
  return baseSpacing * packingConfig.factor * importanceFactor;
};

/**
 * Checks if two line segments intersect
 */
const doLineSegmentsIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
  const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denominator === 0) return false;

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
};
/**
 * Calculates the rotated bounding box for a word with configurable padding
 */
const getRotatedBoundingBox = (
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotation: number,
  spacing: number
): BoundingBox => {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // Add configurable padding
  width += spacing * 2;
  height += spacing * 2;

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
 * Checks if two bounding boxes intersect using enhanced collision detection
 */
const checkBoundingBoxesIntersect = (box1: BoundingBox, box2: BoundingBox): boolean => {
  // Quick AABB (Axis-Aligned Bounding Box) test first
  const box1Bounds = {
    minX: Math.min(...box1.points.map((p) => p.x)),
    maxX: Math.max(...box1.points.map((p) => p.x)),
    minY: Math.min(...box1.points.map((p) => p.y)),
    maxY: Math.max(...box1.points.map((p) => p.y)),
  };

  const box2Bounds = {
    minX: Math.min(...box2.points.map((p) => p.x)),
    maxX: Math.max(...box2.points.map((p) => p.x)),
    minY: Math.min(...box2.points.map((p) => p.y)),
    maxY: Math.max(...box2.points.map((p) => p.y)),
  };

  // If AABB don't intersect, polygons don't intersect
  if (
    box1Bounds.maxX < box2Bounds.minX ||
    box1Bounds.minX > box2Bounds.maxX ||
    box1Bounds.maxY < box2Bounds.minY ||
    box1Bounds.minY > box2Bounds.maxY
  ) {
    return false;
  }

  // Check if one box is completely inside the other
  const isPointInsideBox = (point: Point, box: BoundingBox): boolean => {
    let inside = false;
    for (let i = 0, j = box.points.length - 1; i < box.points.length; j = i++) {
      const xi = box.points[i].x;
      const yi = box.points[i].y;
      const xj = box.points[j].x;
      const yj = box.points[j].y;

      const intersect =
        yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
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
 * Enhanced spiral position calculation with better space utilization
 */
const getSpiralPosition = (
  attempt: number,
  maxAttempts: number,
  normalizedValue: number,
  width: number,
  height: number,
  packingConfig: PackingConfig,
  rotationMode: "any" | "orthogonal" = "any"
): { x: number; y: number; rotation: number } => {
  const t = attempt / maxAttempts;

  // Dynamic spiral density based on configuration and progress
  const baseDensity = packingConfig.spiralDensity || 12;
  const densityFactor = 2 - packingConfig.factor;
  const spiralDensity = baseDensity * densityFactor;

  // Dynamically adjusted angle based on packing density
  const angle = t * 2 * Math.PI * spiralDensity;

  // Smart spiral growth based on multiple factors
  const growthFactors = {
    importance: 1 - normalizedValue * 0.5, // Important words placed closer to center
    progress: t * 1.5, // Gradually expand outward
    packing: 1 / packingConfig.factor, // Tighter packing = slower growth
  };

  const spiralGrowth = growthFactors.importance * growthFactors.progress * growthFactors.packing;

  // Calculate initial and max radius based on container size
  const containerSize = Math.min(width, height);
  const initialRadius = containerSize * 0.05 * packingConfig.factor;
  const maxRadius = containerSize * 0.45;

  // Calculate current radius with smooth growth
  const radius = initialRadius + (maxRadius - initialRadius) * (1 - Math.exp(-spiralGrowth * 3));

  // Determine rotation based on strategy
  let rotation = 0;
  if (rotationMode === "orthogonal") {
    // Only use 0 or -90 degrees
    rotation = Math.random() > 0.5 ? 0 : -90;
    // Add tiny random variation to avoid perfect alignment
    rotation += (Math.random() - 0.5) * 2;
  } else {
    if (packingConfig.bruteForce) {
      // Try different rotations based on progress
      const rotationAttempts = [0, 45, 90, -45];
      const rotationIndex = Math.floor(attempt / (maxAttempts / rotationAttempts.length));
      rotation = rotationAttempts[rotationIndex] || 0;
      // Add small random variation to avoid grid-like patterns
      rotation += (Math.random() - 0.5) * 10;
    } else {
      // Simple horizontal/vertical alternation with slight randomness
      rotation = Math.random() > 0.5 ? 0 + (Math.random() - 0.5) * 5 : 90 + (Math.random() - 0.5) * 5;
    }
  }

  return {
    x: width / 2 + radius * Math.cos(angle),
    y: height / 2 + radius * Math.sin(angle),
    rotation,
  };
};

/**
 * Processes words and calculates their positions using enhanced placement algorithm
 */
const processWords = (
  inputWords: WordCloudWord[],
  width: number,
  height: number,
  fontConfig: FontSizeConfig,
  packingConfig: PackingConfig,
  rotationMode: "any" | "orthogonal" = "any",
  scaleType: ScaleType = "linear"
): ProcessedWord[] => {
  const placedWords: ProcessedWord[] = [];
  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");

  if (!ctx) return [];

  // Sort words by value for consistent layout
  const sortedWords = [...inputWords].sort((a, b) => b.value - a.value);
  const maxValue = Math.max(...sortedWords.map((w) => w.value));
  const minValue = Math.min(...sortedWords.map((w) => w.value));

  // Calculate container center for distance-based optimizations
  const center = { x: width / 2, y: height / 2 };

  sortedWords.forEach((word) => {
    const normalizedValue = normalizeValue(word.value, minValue, maxValue, scaleType);
    const fontSize = calculateFontSize({ width, height }, sortedWords, fontConfig, normalizedValue);

    // Measure text dimensions
    ctx.font = `${fontSize}px Arial`;
    const metrics = ctx.measureText(word.text);
    const wordWidth = metrics.width;
    const wordHeight = fontSize;

    let placed = false;
    let attempts = 0;
    const maxAttempts = packingConfig.maxAttempts || 500;
    let bestPosition: { x: number; y: number; rotation: number } | null = null;
    let bestDistance = Infinity;
    let bestBox: BoundingBox | null = null;

    // Try to place the word
    while (!placed && attempts < maxAttempts) {
      const position = getSpiralPosition(
        attempts,
        maxAttempts,
        normalizedValue,
        width,
        height,
        packingConfig,
        rotationMode
      );

      const spacing = getWordSpacing(
        { ...word, ...position, fontSize, width: wordWidth, height: wordHeight },
        packingConfig,
        normalizedValue
      );

      const newWordBox = getRotatedBoundingBox(
        position.x,
        position.y,
        wordWidth,
        wordHeight,
        position.rotation,
        spacing
      );

      // Check for collisions
      const hasOverlap = placedWords.some((placedWord) =>
        checkBoundingBoxesIntersect(newWordBox, placedWord.boundingBox!)
      );

      // Check if word is within bounds with dynamic margin
      const marginPercent = 0.02 * packingConfig.factor;
      const margin = Math.min(width, height) * marginPercent;
      const inBounds = newWordBox.points.every(
        (point) =>
          point.x >= margin && point.x <= width - margin && point.y >= margin && point.y <= height - margin
      );

      if (!hasOverlap && inBounds) {
        // Calculate distance to center
        const distance = Math.sqrt(Math.pow(position.x - center.x, 2) + Math.pow(position.y - center.y, 2));

        // Keep track of the position closest to center
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPosition = position;
          bestBox = newWordBox;
        }

        // If we're close enough to center or running out of attempts, use this position
        if (distance < width * 0.1 || attempts > maxAttempts * 0.8) {
          placed = true;
        }
      }

      attempts++;
    }
    // Use the best found position, or the last valid position if none better was found
    if (bestPosition && bestBox) {
      placedWords.push({
        ...word,
        ...bestPosition,
        fontSize,
        width: wordWidth,
        height: wordHeight,
        boundingBox: bestBox,
      });
    }
  });
  return placedWords;
};

/**
 * Calculates layout statistics with corrected word counting
 * @param processedWords - Array of words after position processing
 * @param originalWordCount - Total number of input words
 * @param attempts - Record of placement attempts per word
 */
const calculateLayoutStats = (
  processedWords: ProcessedWord[],
  originalWordCount: number,
  attempts: { [key: string]: number },
  width: number,
  height: number
) => {
  const placedWords = processedWords.filter((w) => w.boundingBox).length;
  const avgAttempts = Object.values(attempts).reduce((a, b) => a + b, 0) / originalWordCount;

  // Calculate approximate coverage
  const totalArea = width * height;
  const coveredArea = processedWords.reduce((area, word) => {
    if (!word.boundingBox) return area;
    const box = word.boundingBox;
    const boxArea = Math.abs((box.points[0].x - box.points[2].x) * (box.points[0].y - box.points[2].y));
    return area + boxArea;
  }, 0);

  return {
    placed: placedWords,
    total: originalWordCount,
    avgAttempts: Math.round(avgAttempts * 10) / 10,
    coverage: Math.round((coveredArea / totalArea) * 1000) / 10,
  };
};

/**
 * Enhanced WordCloud React component with improved space utilization and animations
 */
const WordCloud: React.FC<WordCloudProps> = ({
  words,
  width: providedWidth,
  height: providedHeight,
  fontConfig = DEFAULT_FONT_CONFIG,
  packingConfig = DEFAULT_PACKING_CONFIG,
  scaleType = "linear",
  rotationMode = "any",
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
  const [stats, setStats] = useState({
    placed: 0,
    total: 0,
    avgAttempts: 0,
    coverage: 0,
  });

  // Use provided dimensions or measured dimensions
  const width = providedWidth ?? dimensions.width;
  const height = providedHeight ?? dimensions.height;

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
      const originalWordCount = words.length; // Store original count
      const processed = processWords(
        words,
        width,
        height,
        fontConfig,
        packingConfig,
        rotationMode,
        scaleType
      );

      const attempts: { [key: string]: number } = {};
      words.forEach((word) => {
        attempts[word.text] = 0;
      });

      setProcessedWords(processed);
      setPlacementAttempts(attempts);
      // Update stats with original word count
      const newStats = calculateLayoutStats(processed, originalWordCount, attempts, width, height);
      setStats(newStats);
    }
  }, [words, width, height, fontConfig, packingConfig, scaleType]);

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
          +{" "}
          {processedWords
            .filter((word) => word.boundingBox)
            .map((word, index) => {
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
                          {showDebug && word.boundingBox && (
                            <>
                              <rect
                                x={-word.width / 2}
                                y={-word.height / 2}
                                width={word.width}
                                height={word.height}
                                fill="none"
                                stroke="red"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                                style={{ pointerEvents: "none" }}
                              />
                              <path
                                d={`M ${word.boundingBox.points
                                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x - word.x} ${p.y - word.y}`)
                                  .join(" ")} Z`}
                                fill="none"
                                stroke="blue"
                                strokeWidth="1"
                                style={{ pointerEvents: "none" }}
                              />
                            </>
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
        <div className="absolute inset-x-0 bottom-0 p-4 bg-white/90 border-t flex justify-between items-center text-sm">
          <div className="flex gap-4">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-3 py-1 bg-white border rounded shadow hover:bg-gray-50"
            >
              Show Bounding Boxes 
            </button>
            <div className="flex items-center gap-2">
              <span className="font-medium">Stats:</span>
              <span>
                {stats.placed}/{stats.total} words placed ({Math.round((stats.placed / stats.total) * 100)}%)
              </span>
              <span>|</span>
              <span>{stats.avgAttempts} avg attempts</span>
              <span>|</span>
              <span>{stats.coverage}% coverage</span>
            </div>
          </div>
          <div className="flex gap-4 text-gray-600">
            <div>Packing: {packingConfig.factor}x</div>
            <div>Strategy: {packingConfig.strategy}</div>
            <div>
              Font: {fontConfig.min}% - {fontConfig.max}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordCloud;
