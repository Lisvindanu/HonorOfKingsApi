import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { execSync } from "child_process";

const API_DATA_PATH = "/root/HonorOfKingsApi/output/merged-api.json";
const SKINS_DIR = "/root/HonorOfKingsApi/public/images/skins";

fs.mkdirSync(SKINS_DIR, { recursive: true });

const data = JSON.parse(fs.readFileSync(API_DATA_PATH, "utf8"));
const heroes = Object.values(data.main);

// Collect all skins
const allSkins = [];
for (const hero of heroes) {
  if (hero.skins) {
    for (let i = 0; i < hero.skins.length; i++) {
      const skin = hero.skins[i];
      const url = skin.skinImage || skin.skinCover;
      // Only include valid URLs from honorofkings domain
      if (url && url.includes("honorofkings.com")) {
        allSkins.push({
          heroId: hero.heroId,
          heroName: hero.name,
          skinIndex: i,
          skinName: skin.skinName,
          url: url
        });
      }
    }
  }
}

console.log("Found " + allSkins.length + " valid skins to download");

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    
    const req = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(destPath); } catch(e) {}
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch(e) {}
        reject(new Error("HTTP " + response.statusCode));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });
    
    req.on("error", (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch(e) {}
      reject(err);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

async function processSkins() {
  let downloaded = 0, converted = 0, skipped = 0, failed = 0;

  for (const skin of allSkins) {
    const filename = skin.heroId + "_" + skin.skinIndex;
    const webpPath = path.join(SKINS_DIR, filename + ".webp");
    
    if (fs.existsSync(webpPath)) {
      skipped++;
      continue;
    }

    try {
      // Get extension from URL path only
      const urlPath = new URL(skin.url).pathname;
      const ext = path.extname(urlPath) || ".jpg";
      const tempPath = path.join(SKINS_DIR, filename + "_temp" + ext);
      
      process.stdout.write("[" + (downloaded + skipped + failed + 1) + "/" + allSkins.length + "] " + skin.skinName + "... ");
      await downloadFile(skin.url, tempPath);
      downloaded++;

      execSync("cwebp -q 80 " + tempPath + " -o " + webpPath, { stdio: "pipe" });
      converted++;

      fs.unlinkSync(tempPath);
      console.log("OK");
    } catch (err) {
      console.log("SKIP (" + err.message + ")");
      failed++;
    }
  }

  console.log("\n=== Summary ===");
  console.log("Downloaded: " + downloaded);
  console.log("Converted: " + converted);
  console.log("Skipped (exists): " + skipped);
  console.log("Failed: " + failed);
  
  const files = fs.readdirSync(SKINS_DIR).filter(f => f.endsWith(".webp"));
  const totalSize = files.reduce((acc, f) => acc + fs.statSync(path.join(SKINS_DIR, f)).size, 0);
  console.log("Total files: " + files.length);
  console.log("Total size: " + (totalSize / 1024 / 1024).toFixed(1) + " MB");
}

processSkins().catch(console.error);
