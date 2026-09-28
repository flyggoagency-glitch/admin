const fs = require("fs");
const path = require("path");

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file === "page.tsx") {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes("next/dynamic") && content.includes("ssr: false")) {
        continue;
      }
      const clientPath = path.join(dir, "ClientPage.tsx");
      fs.renameSync(fullPath, clientPath);
      const newPageContent = "\"use client\";\nimport dynamic from \"next/dynamic\";\n\nconst ClientPage = dynamic(() => import(\"./ClientPage\"), { ssr: false });\n\nexport default function Page() {\n  return <ClientPage />;\n}\n";
      fs.writeFileSync(fullPath, newPageContent);
      console.log("Processed:", fullPath);
    }
  }
}

const appDir = path.join(process.cwd(), "src", "app");
const dirs = ["developer", "founder", "telecaller"];

for (const d of dirs) {
  const targetDir = path.join(appDir, d);
  if (fs.existsSync(targetDir)) {
    processDir(targetDir);
  }
}

