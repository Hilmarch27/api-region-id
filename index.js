const express = require("express");
const path = require("path");
const { Repository, Generator } = require("./generator");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to serve static JSON files
app.use("/api", express.static(path.join(__dirname, "static", "api")));

// Generate API endpoints
async function generateApiEndpoints() {
  const dataDir = path.join(__dirname, "data");
  const outputDir = path.join(__dirname, "static", "api");

  const repository = new Repository(dataDir);
  const generator = new Generator(repository, outputDir);

  console.log("Clearing output directory...");
  await generator.clearOutputDir();

  console.log("Generating API endpoints...");
  await generator.generate();
  console.log("API generation complete!");
}

// Start the server
app.listen(PORT, async () => {
  try {
    await generateApiEndpoints();
    console.log(`Server is running on http://localhost:${PORT}`);
  } catch (error) {
    console.error("Error generating API endpoints:", error);
    process.exit(1);
  }
});
