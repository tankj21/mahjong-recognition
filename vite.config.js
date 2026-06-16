import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      assert: resolve(__dirname, 'src/assert-mock.js')
    }
  }
});
