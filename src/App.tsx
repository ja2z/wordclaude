import { useMemo } from "react";
import WordCloud, { WordCloudWord } from "./components/wordClaude";
import "./App.css";
import { client, useConfig, useElementData } from "@sigmacomputing/plugin";

client.config.configureEditorPanel([
  { name: "source", type: "element" },
  { name: "tokenize", type: "dropdown", values: ["Yes", "No"], defaultValue: "Yes" },
  { name: "debug", type: "dropdown", values: ["True", "False"], defaultValue: "False" },
  { name: "text", type: "column", source: "source", allowMultiple: false },
  { name: "value", type: "column", source: "source", allowMultiple: false },
]);

function App() {
  const config = useConfig();
  const sourceData = useElementData(config.source);

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

  const handleWordClick = (word: WordCloudWord) => {
    // You can implement your custom logic here
    console.log(`Clicked on word: ${word.text} with value: ${word.value}`);
    // Example: Update some state, trigger an API call, etc.
  };

  // Get debug setting from client config and convert string to boolean
  const debugMode = (client.config.getKey as any)("debug") === "True";

  return (
    <div className="fixed inset-0 w-full h-full">
      <WordCloud
        words={transformedWords}
        minFontSize={2} // 3% of container height
        maxFontSize={13} // 15% of container height
        scaleType="linear"
        debug={debugMode}
        onWordClick={handleWordClick}
      />
    </div>
  );
}

export default App;
