import UnpluginTypia from "@ryoppippi/unplugin-typia/esbuild";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/!(*.d|*.test).ts"],
  clean: true,
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  splitting: true,
  esbuildPlugins: [UnpluginTypia()],
});
