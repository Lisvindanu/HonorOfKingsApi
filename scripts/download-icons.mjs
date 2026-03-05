import fs from "fs";
import path from "path";
import https from "https";
import { execSync } from "child_process";

const API_DATA_PATH = "/root/HonorOfKingsApi/output/merged-api.json";
const ICONS_DIR = "/root/HonorOfKingsApi/public/images/heroes/icons";

fs.mkdirSync(ICONS_DIR, { recursive: true });

const data = JSON.parse(fs.readFileSync(API_DATA_PATH, "utf8"));
const heroes = Object.values(data.main);

console.log("Found " + heroes.length + " heroes");

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function processHeroes() {
  let downloaded = 0, converted = 0, skipped = 0;

  for (const hero of heroes) {
    const heroId = hero.heroId;
    const iconUrl = hero.icon;
    
    if (!iconUrl) {
      console.log("Skip " + hero.name + ": no icon URL");
      skipped++;
      continue;
    }

    const webpPath = path.join(ICONS_DIR, heroId + ".webp");
    
    if (fs.existsSync(webpPath)) {
      console.log("Skip " + hero.name + ": already exists");
      skipped++;
      continue;
    }

    try {
      const ext = iconUrl.split(".").pop().split("?")[0];
      const tempPath = path.join(ICONS_DIR, heroId + "_temp." + ext);
      
      console.log("Downloading " + hero.name + " (" + heroId + ")...");
      await downloadFile(iconUrl, tempPath);
      downloaded++;

      console.log("Converting " + hero.name + " to WebP...");
      execSync("cwebp -q 85 " + tempPath + " -o " + webpPath, { stdio: "pipe" });
      converted++;

      fs.unlinkSync(tempPath);
      console.log("Done " + hero.name);
    } catch (err) {
      console.error("Failed " + hero.name + ": " + err.message);
    }
  }

  console.log("\nSummary:");
  console.log("- Downloaded: " + downloaded);
  console.log("- Converted: " + converted);
  console.log("- Skipped: " + skipped);
  
  const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith(".webp"));
  const totalSize = files.reduce((acc, f) => acc + fs.statSync(path.join(ICONS_DIR, f)).size, 0);
  console.log("- Total files: " + files.length);
  console.log("- Total size: " + (totalSize / 1024).toFixed(1) + " KB");
}

processHeroes().catch(console.error);
