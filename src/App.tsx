import { useMemo } from "react";
import WordCloud, { WordCloudWord, FontSizeConfig } from "./components/wordClaude";
import "./App.css";
import { client, useConfig, useElementData, useVariable } from "@sigmacomputing/plugin";

/**
 * Configure the editor panel with necessary inputs
 */
client.config.configureEditorPanel([
  { name: "source", type: "element" },
  { name: "tokenize", type: "dropdown", values: ["Yes", "No"], defaultValue: "Yes" },
  { name: "fontMinMax", type: "variable" },
  { name: "scaleFactor", type: "variable" },
  { name: "text", type: "column", source: "source", allowMultiple: false },
  { name: "value", type: "column", source: "source", allowMultiple: false },
]);

// Default values for font configuration
const DEFAULT_FONT_CONFIG = {
  min: 1,
  max: 10
};

// Default value for scale factor
const DEFAULT_SCALE_FACTOR = 1.2;

/**
 * Main App component that renders the WordCloud visualization
 * Handles data transformation and configuration management
 */
function App() {
  const config = useConfig();
  const sourceData = useElementData(config.source);
  
  // Extract and validate scale factor from configuration
  const scaleFactorConfig = useVariable(config.scaleFactor);
  const scaleFactor = useMemo(() => {
    // Early return if config is null or undefined
    if (!scaleFactorConfig?.[0]?.defaultValue) {
      return DEFAULT_SCALE_FACTOR;
    }

    // Type assertion to access the number value
    const valueConfig = scaleFactorConfig[0].defaultValue as {
      type: string;
      value?: number;
    };
    
    const value = Number(valueConfig.value ?? DEFAULT_SCALE_FACTOR);
    
    // Ensure the value is a valid positive number
    return isNaN(value) || value <= 0 ? DEFAULT_SCALE_FACTOR : value;
  }, [scaleFactorConfig]);

  // Extract and validate font min/max from configuration
  const fontMinMaxConfig = useVariable(config.fontMinMax);
  const fontRange = useMemo(() => {
    // Early return if config is null or undefined
    if (!fontMinMaxConfig?.[0]?.defaultValue) {
      return DEFAULT_FONT_CONFIG;
    }

    // Type assertion to access the number-range properties
    const rangeConfig = fontMinMaxConfig[0].defaultValue as { 
      type: string;
      min?: number;
      max?: number;
    };
    
    // Extract min and max with default fallbacks
    const minValue = Number(rangeConfig.min ?? DEFAULT_FONT_CONFIG.min);
    const maxValue = Number(rangeConfig.max ?? DEFAULT_FONT_CONFIG.max);
    
    // Validate values and return defaults if invalid
    if (isNaN(minValue) || isNaN(maxValue) || minValue >= maxValue) {
      return DEFAULT_FONT_CONFIG;
    }

    return {
      min: minValue,
      max: maxValue
    };
  }, [fontMinMaxConfig]);

  // Transform data from Sigma format to WordCloud format
  const transformedWords = useMemo<WordCloudWord[]>(() => {
    // If we don't have the required data or columns, return empty array
    if (!sourceData || !config.text || !config.value) {
      return [];
    }

    const textColumnId = config.text;
    const valueColumnId = config.value;

    // Get the arrays of text and values from sourceData
    const textArray = sourceData[textColumnId];
    const valueArray = sourceData[valueColumnId];

    // If either array is missing, return empty array
    if (!textArray || !valueArray) {
      return [];
    }

    // Transform the data into WordCloudWord format
    return textArray.map((text, index) => ({
      text: String(text), // Ensure text is string
      value: Number(valueArray[index]) || 0, // Convert to number, default to 0 if invalid
    }));
  }, [sourceData, config.text, config.value]);

  /**
   * Handle click events on individual words
   * Can be extended to implement custom interactions
   */
  const handleWordClick = (word: WordCloudWord) => {
    console.log(`Clicked on word: ${word.text} with value: ${word.value}`);
    // Implement additional click handling logic here
  };

  // Get debug setting from client config
  const debugMode = (client.config.getKey as any)("debug") === "True";

  // Custom font configuration with dynamic scale factor and font range
  const customFontConfig: FontSizeConfig = {
    min: fontRange.min,
    max: fontRange.max,
    scaleFactor: scaleFactor,
    wordCountScaling: {
      enabled: true,
      minScale: 0.4,
      maxScale: 1.5,
      threshold: 75
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full">
      <WordCloud
        words={transformedWords}
        fontConfig={customFontConfig}
        scaleType="linear"
        debug={debugMode}
        onWordClick={handleWordClick}
      />
    </div>
  );
}

export default App;