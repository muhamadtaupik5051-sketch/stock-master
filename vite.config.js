import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";

// Menyalin icon & manifest ke hasil build (struktur proyek ini datar, tanpa folder public).
const copyStatic = () => ({
  name: "copy-static",
  closeBundle() {
    mkdirSync("dist", { recursive: true });
    for (const f of ["icon.svg", "manifest.webmanifest"]) copyFileSync(f, "dist/" + f);
  }
});

export default defineConfig({ plugins: [react(), copyStatic()] });
