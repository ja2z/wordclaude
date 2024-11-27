import { useMemo } from "react";
import WordCloud, { WordCloudWord, FontSizeConfig, PackingConfig } from "./components/wordClaude";
import "./App.css";
import { client, useConfig, useElementData, useVariable } from "@sigmacomputing/plugin";

// Common English stop words to filter out
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "&",
  "or",
  "but",
  "yet",
  "so",
]);

/**
 * Tokenizes and cleans text by removing punctuation, numbers, and stop words
 * Filters out words shorter than the minimum length
 * @param text Input text to process
 * @param minLength Minimum word length to include
 * @returns Array of cleaned tokens
 */
const tokenizeText = (text: string, minLength: number): string[] => {
  if (!text) return [];

  // Convert to lowercase and replace special characters with spaces
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Split into tokens and filter out stop words, empty strings, and short words
  return cleaned.split(" ").filter(
    (token) =>
      token &&
      token.length >= minLength &&
      !STOP_WORDS.has(token) &&
      // Keep tokens that either contain a letter or are purely numeric
      (/[a-z]/.test(token) || /^\d+$/.test(token))
  );
};

/**
 * Configure the editor panel with necessary inputs
 */
client.config.configureEditorPanel([
  { name: "source", type: "element" },
  { name: "tokenize", type: "variable" },
  { name: "minWordLength", type: "variable" },
  { name: "fontMinMax", type: "variable" },
  { name: "scaleFactor", type: "variable" },
  { name: "packingFactor", type: "variable" },
  { name: "packingStrategy", type: "variable" },
  { name: "packingMinSpacing", type: "variable" },
  { name: "packingBruteForce", type: "variable" },
  { name: "rotationMode", type: "variable" },
  { name: "scaleType", type: "variable" },
  { name: "wordCountEnabled", type: "variable" },
  { name: "wordCountMinMaxScale", type: "variable" },
  { name: "wordCountThreshold", type: "variable" },
  { name: "debug", type: "variable" },
  { name: "text", type: "column", source: "source", allowMultiple: false },
  { name: "value", type: "column", source: "source", allowMultiple: false },
]);

// Default values for font configuration
const DEFAULT_FONT_CONFIG = {
  min: 1,
  max: 10,
};

// Default packing configuration values
const DEFAULT_PACKING_CONFIG: PackingConfig = {
  factor: 0.8,
  strategy: "adaptive",
  minSpacing: 2,
  bruteForce: true,
};

// Default value for scale factor
const DEFAULT_SCALE_FACTOR = 1.2;

// Default values for word count scaling
const DEFAULT_WORD_COUNT_CONFIG = {
  enabled: true,
  minScale: 0.4,
  maxScale: 1.5,
  threshold: 50,
};

// Default minimum word length
const DEFAULT_MIN_WORD_LENGTH = 3;

// Default values
const DEFAULT_ROTATION_MODE = "orthogonal" as const;
const DEFAULT_SCALE_TYPE = "linear" as const;

/**
 * Main App component that renders the WordCloud visualization
 * Handles data transformation and configuration management
 */
function App() {
  const config = useConfig();
  const sourceData = useElementData(config.source);

  // Get all configuration variables
  const tokenizeConfig = useVariable(config.tokenize);
  const minWordLengthConfig = useVariable(config.minWordLength);
  const scaleFactorConfig = useVariable(config.scaleFactor);
  const fontMinMaxConfig = useVariable(config.fontMinMax);
  const wordCountEnabledConfig = useVariable(config.wordCountEnabled);
  const wordCountMinMaxScaleConfig = useVariable(config.wordCountMinMaxScale);
  const wordCountThresholdConfig = useVariable(config.wordCountThreshold);
  const debugConfig = useVariable(config.debug);
  const packingFactorConfig = useVariable(config.packingFactor);
  const packingStrategyConfig = useVariable(config.packingStrategy);
  const packingMinSpacingConfig = useVariable(config.packingMinSpacing);
  const packingBruteForceConfig = useVariable(config.packingBruteForce);
  const rotationModeConfig = useVariable(config.rotationMode);
  const scaleTypeConfig = useVariable(config.scaleType);

    // Process rotation mode
    const rotationMode = useMemo(() => {
      const modeValue = (rotationModeConfig?.[0]?.defaultValue as { value?: string })?.value;
      return (modeValue === "orthogonal" || modeValue === "any") 
        ? modeValue 
        : DEFAULT_ROTATION_MODE;
    }, [rotationModeConfig]);
  
    // Process scale type
    const scaleType = useMemo(() => {
      const typeValue = (scaleTypeConfig?.[0]?.defaultValue as { value?: string })?.value;
      return (typeValue === "linear" || typeValue === "logarithmic") 
        ? typeValue 
        : DEFAULT_SCALE_TYPE;
    }, [scaleTypeConfig]);

  // Process packing configuration
  const packingConfig = useMemo(() => {
    // Extract and validate factor
    const factorValue = (packingFactorConfig?.[0]?.defaultValue as { value?: number })?.value;
    const factor =
      !isNaN(Number(factorValue)) && factorValue !== null
        ? Number(factorValue)
        : DEFAULT_PACKING_CONFIG.factor;

    // Extract and validate strategy
    const strategyValue = (packingStrategyConfig?.[0]?.defaultValue as { value?: string })?.value;
    const strategy =
      strategyValue === "uniform" || strategyValue === "adaptive"
        ? strategyValue
        : DEFAULT_PACKING_CONFIG.strategy;

    // Extract and validate minSpacing
    const minSpacingValue = (packingMinSpacingConfig?.[0]?.defaultValue as { value?: number })?.value;
    const minSpacing =
      !isNaN(Number(minSpacingValue)) && minSpacingValue !== null
        ? Number(minSpacingValue)
        : DEFAULT_PACKING_CONFIG.minSpacing;

    // Extract and validate bruteForce
    const bruteForceValue = (packingBruteForceConfig?.[0]?.defaultValue as { value?: boolean })?.value;
    const bruteForce =
      typeof bruteForceValue === "boolean" ? bruteForceValue : DEFAULT_PACKING_CONFIG.bruteForce;

    return {
      factor,
      strategy,
      minSpacing,
      bruteForce,
    } as PackingConfig;
  }, [packingFactorConfig, packingStrategyConfig, packingMinSpacingConfig, packingBruteForceConfig]);

  // Process tokenize configuration
  const shouldTokenize = useMemo(() => {
    const tokenizeValue = (tokenizeConfig?.[0]?.defaultValue as { value?: boolean })?.value;
    return tokenizeValue ?? false; // Explicitly default to false
  }, [tokenizeConfig]);

  // Process minimum word length configuration
  const minWordLength = useMemo(() => {
    const lengthValue = (minWordLengthConfig?.[0]?.defaultValue as { value?: number })?.value;
    const parsedLength = Number(lengthValue);
    return !isNaN(parsedLength) && parsedLength > 0 ? parsedLength : DEFAULT_MIN_WORD_LENGTH;
  }, [minWordLengthConfig]);

  // Process scale factor configuration
  const scaleFactor = useMemo(() => {
    if (!scaleFactorConfig?.[0]?.defaultValue) {
      return DEFAULT_SCALE_FACTOR;
    }

    const valueConfig = scaleFactorConfig[0].defaultValue as {
      type: string;
      value?: number;
    };

    const value = Number(valueConfig.value ?? DEFAULT_SCALE_FACTOR);
    return isNaN(value) || value <= 0 ? DEFAULT_SCALE_FACTOR : value;
  }, [scaleFactorConfig]);

  // Process font range configuration
  const fontRange = useMemo(() => {
    if (!fontMinMaxConfig?.[0]?.defaultValue) {
      return DEFAULT_FONT_CONFIG;
    }

    const rangeConfig = fontMinMaxConfig[0].defaultValue as {
      type: string;
      min?: number;
      max?: number;
    };

    const minValue = Number(rangeConfig.min ?? DEFAULT_FONT_CONFIG.min);
    const maxValue = Number(rangeConfig.max ?? DEFAULT_FONT_CONFIG.max);

    if (isNaN(minValue) || isNaN(maxValue) || minValue >= maxValue) {
      return DEFAULT_FONT_CONFIG;
    }

    return {
      min: minValue,
      max: maxValue,
    };
  }, [fontMinMaxConfig]);

  // Process word count scaling configuration
  const wordCountConfig = useMemo(() => {
    const enabledValue = (wordCountEnabledConfig?.[0]?.defaultValue as { value?: boolean })?.value;

    const scaleRangeConfig = wordCountMinMaxScaleConfig?.[0]?.defaultValue as {
      type: string;
      min?: number;
      max?: number;
    };

    const minScale = Number(scaleRangeConfig?.min ?? DEFAULT_WORD_COUNT_CONFIG.minScale);
    const maxScale = Number(scaleRangeConfig?.max ?? DEFAULT_WORD_COUNT_CONFIG.maxScale);

    const thresholdValue = (wordCountThresholdConfig?.[0]?.defaultValue as { value?: number })?.value;

    return {
      enabled: enabledValue ?? DEFAULT_WORD_COUNT_CONFIG.enabled,
      minScale: isNaN(minScale) ? DEFAULT_WORD_COUNT_CONFIG.minScale : minScale,
      maxScale: isNaN(maxScale) ? DEFAULT_WORD_COUNT_CONFIG.maxScale : maxScale,
      threshold: Number(thresholdValue ?? DEFAULT_WORD_COUNT_CONFIG.threshold),
    };
  }, [wordCountEnabledConfig, wordCountMinMaxScaleConfig, wordCountThresholdConfig]);

  // Process debug configuration
  const debug = useMemo(() => {
    const debugValue = (debugConfig?.[0]?.defaultValue as { value?: boolean })?.value;
    return debugValue ?? false;
  }, [debugConfig]);

  // Transform data from Sigma format to WordCloud format with optional tokenization
  const transformedWords = useMemo<WordCloudWord[]>(() => {
    if (!sourceData || !config.text || !config.value) {
      return [];
    }

    const textColumnId = config.text;
    const valueColumnId = config.value;

    const textArray = sourceData[textColumnId];
    const valueArray = sourceData[valueColumnId];

    if (!textArray || !valueArray) {
      return [];
    }

    if (!shouldTokenize) {
      // When not tokenizing, filter out words shorter than minWordLength
      return textArray
        .map((text, index) => ({
          text: String(text),
          value: Number(valueArray[index]) || 0,
        }))
        .filter((word) => word.text.length >= minWordLength);
    }

    // Tokenization enabled: process each text entry and create word frequency map
    const wordFrequencyMap = new Map<string, number>();

    textArray.forEach((text, index) => {
      const value = Number(valueArray[index]) || 0;
      const tokens = tokenizeText(String(text), minWordLength);

      tokens.forEach((token) => {
        const currentValue = wordFrequencyMap.get(token) || 0;
        wordFrequencyMap.set(token, currentValue + value);
      });
    });

    // Convert frequency map to word cloud format
    return Array.from(wordFrequencyMap.entries()).map(([text, value]) => ({
      text,
      value,
    }));
  }, [sourceData, config.text, config.value, shouldTokenize, minWordLength]);

  /**
   * Handle click events on individual words
   */
  const handleWordClick = (word: WordCloudWord) => {
    console.log(`Clicked on word: ${word.text} with value: ${word.value}`);
  };

  // Custom font configuration
  const customFontConfig: FontSizeConfig = {
    min: fontRange.min,
    max: fontRange.max,
    scaleFactor: scaleFactor,
    wordCountScaling: {
      enabled: wordCountConfig.enabled,
      minScale: wordCountConfig.minScale,
      maxScale: wordCountConfig.maxScale,
      threshold: wordCountConfig.threshold,
    },
  };

  return (
    <div className="fixed inset-0 w-full h-full">
      <WordCloud
        words={transformedWords}
        rotationMode={rotationMode} // "orthogonal" or "any"
        fontConfig={customFontConfig}
        packingConfig={packingConfig}
        scaleType={scaleType} // "logarithmic" or "linear"
        debug={debug}
        onWordClick={handleWordClick}
      />
    </div>
  );
}

export default App;
