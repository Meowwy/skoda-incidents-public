// build.js
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// ES Module setup for __dirname in modern Node (since Vite uses type: "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define our entry point and output destination
const ENTRY_FILE = path.resolve(__dirname, 'questions/main.yaml'); 
const OUTPUT_FILE = path.resolve(__dirname, 'src/assets/compiled-schema.json');

function stitchYaml(filePath) {
  console.log(`📄 Reading: ${path.relative(__dirname, filePath)}`);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedYaml = yaml.load(fileContent);
    
    if (parsedYaml && parsedYaml.steps) {
      let mergedSteps = [];
      
      for (const step of parsedYaml.steps) {
        if (step.$include) {
           // Resolve the included file's path relative to the CURRENT file
           const includePath = path.resolve(path.dirname(filePath), step.$include);
           
           // Recursively stitch the included file
           const includedContent = stitchYaml(includePath);
           
           if (includedContent && includedContent.steps) {
               mergedSteps = mergedSteps.concat(includedContent.steps);
           }
        } else {
           // Standard question step
           mergedSteps.push(step);
        }
      }
      parsedYaml.steps = mergedSteps;
    }
    
    return parsedYaml;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    process.exit(1); // Stop the build if a YAML file is broken
  }
}

// 1. Run the stitcher
console.log('🔄 Starting YAML compilation...');
const finalSchema = stitchYaml(ENTRY_FILE);

// 2. Ensure the output directory exists (src/assets)
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 3. Save the stitched JSON file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalSchema, null, 2));
console.log(`✅ Successfully compiled schema to: ${path.relative(__dirname, OUTPUT_FILE)}`);