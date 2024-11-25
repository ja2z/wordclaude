import { useMemo } from "react";
import WordCloud, { WordCloudWord } from "./components/wordClaude";
import "./App.css";
import { client, useConfig, useElementData } from "@sigmacomputing/plugin";

client.config.configureEditorPanel([
  { name: "yourSource", type: "element" },
  { name: "col1", type: "column", source: "yourSource", allowMultiple: false },
  { name: "col2", type: "column", source: "yourSource", allowMultiple: false },
]);

function App() {
  const config = useConfig();
  const yourSourceData = useElementData(config.yourSource);

  const sampleWords = useMemo<WordCloudWord[]>(
    () => [
      { text: "React", value: 100 },
      { text: "TypeScript is great", value: 90 },
      { text: "JavaScript is awesome", value: 80 },
      { text: "I love HTML", value: 70 },
      { text: "CSS", value: 70 },
      { text: "Node.js", value: 60 },
      { text: "Redux", value: 50 },
      { text: "GraphQL", value: 45 },
      { text: "Docker", value: 40 },
      { text: "Git", value: 35 },
      { text: "AWS", value: 30 },
      { text: "MongoDB", value: 25 },
      { text: "Python", value: 20 },
      { text: "Java", value: 15 },
      { text: "SQL", value: 10 },
    ],
    []
  );

  const handleWordClick = (word: WordCloudWord) => {
    // You can implement your custom logic here
    console.log(`Clicked on word: ${word.text} with value: ${word.value}`);
    // Example: Update some state, trigger an API call, etc.
  };

  return (
    <div className="fixed inset-0 w-full h-full">
      <WordCloud
        words={sampleWords}
        minFontSize={2}  // 3% of container height
        maxFontSize={11} // 15% of container height
        scaleType="linear"
        debug={true}
        onWordClick={handleWordClick}
      />
    </div>
  );
}

export default App;
