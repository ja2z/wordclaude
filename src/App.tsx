import { useMemo } from "react";
import WordCloud, { WordCloudWord, FontSizeConfig, PackingConfig } from "./components/wordClaude";
import "./App.css";
import { client, useConfig, useElementData, useVariable } from "@sigmacomputing/plugin";

// Maximum number of words to display in the cloud
const MAX_WORDS = 200;

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
 * Gets the top N items from an array of WordCloudWord based on value
 * @param words Array of WordCloudWord items
 * @param n Number of top items to return
 * @returns Array of top N WordCloudWord items
 */
const getTopNItems = (words: WordCloudWord[], n: number): WordCloudWord[] => {
  return [...words].sort((a, b) => b.value - a.value).slice(0, n);
};

/**
 * Tokenizes and cleans text by removing punctuation, numbers, and stop words
 * Filters out words shorter than the minimum length and handles null/undefined values
 * @param text Input text to process
 * @param minLength Minimum word length to include
 * @returns Array of cleaned tokens
 */
const tokenizeText = (text: string | null | undefined, minLength: number): string[] => {
  // Handle null, undefined, or empty strings
  if (!text || typeof text !== "string") {
    return [];
  }

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
    return modeValue === "orthogonal" || modeValue === "any" ? modeValue : DEFAULT_ROTATION_MODE;
  }, [rotationModeConfig]);

  // Process scale type
  const scaleType = useMemo(() => {
    const typeValue = (scaleTypeConfig?.[0]?.defaultValue as { value?: string })?.value;
    return typeValue === "linear" || typeValue === "logarithmic" ? typeValue : DEFAULT_SCALE_TYPE;
  }, [scaleTypeConfig]);

  // Process packing configuration
  const packingConfig = useMemo(() => {
    const factorValue = (packingFactorConfig?.[0]?.defaultValue as { value?: number })?.value;
    const factor =
      !isNaN(Number(factorValue)) && factorValue !== null
        ? Number(factorValue)
        : DEFAULT_PACKING_CONFIG.factor;

    const strategyValue = (packingStrategyConfig?.[0]?.defaultValue as { value?: string })?.value;
    const strategy =
      strategyValue === "uniform" || strategyValue === "adaptive"
        ? strategyValue
        : DEFAULT_PACKING_CONFIG.strategy;

    const minSpacingValue = (packingMinSpacingConfig?.[0]?.defaultValue as { value?: number })?.value;
    const minSpacing =
      !isNaN(Number(minSpacingValue)) && minSpacingValue !== null
        ? Number(minSpacingValue)
        : DEFAULT_PACKING_CONFIG.minSpacing;

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
    return tokenizeValue ?? false;
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
      // When not tokenizing, filter out null/undefined values and words shorter than minWordLength
      const filteredWords = textArray
        .map((text, index) => {
          // Skip null/undefined/empty values
          if (!text || typeof text !== "string") {
            return null;
          }
          const value = Number(valueArray[index]);
          // Skip if value is not a valid number
          if (isNaN(value)) {
            // If there's no value provided, use a default value of 1
            // This ensures each word appears once with equal weight
            return {
              text: String(text).trim(),
              value: 1,
            };
          }
          return {
            text: String(text).trim(),
            value: value,
          };
        })
        .filter((word): word is WordCloudWord => word !== null && word.text.length >= minWordLength);

      // Create a Map to deduplicate words and sum their values
      const uniqueWords = new Map<string, number>();
      filteredWords.forEach((word) => {
        const currentValue = uniqueWords.get(word.text) || 0;
        uniqueWords.set(word.text, currentValue + word.value);
      });

      // Convert back to array format
      const deduplicatedWords = Array.from(uniqueWords.entries()).map(([text, value]) => ({
        text,
        value,
      }));

      return getTopNItems(deduplicatedWords, MAX_WORDS);
    }

    // Tokenization enabled: process each text entry and sum weights
    const wordWeights = new Map<string, number>();

    textArray.forEach((text, index) => {
      const value = Number(valueArray[index]);
      // Skip if value is not a valid number
      if (isNaN(value)) {
        return;
      }

      const tokens = tokenizeText(text, minWordLength);

      // Skip empty token arrays
      if (tokens.length === 0) {
        return;
      }

      // Add full weight to each token
      tokens.forEach((token) => {
        const currentWeight = wordWeights.get(token) || 0;
        wordWeights.set(token, currentWeight + value);
      });
    });

    // Convert accumulated weights to final WordCloudWord format
    const words = Array.from(wordWeights.entries()).map(([text, weight]) => ({
      text,
      value: weight,
    }));

    return getTopNItems(words, MAX_WORDS);
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
        rotationMode={rotationMode}
        fontConfig={customFontConfig}
        packingConfig={packingConfig}
        scaleType={scaleType}
        debug={debug}
        onWordClick={handleWordClick}
      />
    </div>
  );
}

export default App;
