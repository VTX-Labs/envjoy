import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  target: "node18",
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  // The shebang is preserved from the top of src/cli.ts so `dist/cli.js`
  // is directly executable as the `envjoy` bin.
});
