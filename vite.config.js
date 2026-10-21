import { resolve } from 'path';
import { defineConfig } from 'vite';

const rootDir = import.meta.dirname;

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        about: resolve(rootDir, 'about.html'),
        contact: resolve(rootDir, 'contact.html'),
        privacy: resolve(rootDir, 'privacy.html'),
        terms: resolve(rootDir, 'terms.html'),
        disclaimer: resolve(rootDir, 'disclaimer.html'),
        guide1: resolve(rootDir, 'guides/secure-act-10-year-rule.html'),
        guide2: resolve(rootDir, 'guides/how-to-avoid-year-10-tax-bomb.html'),
        guide3: resolve(rootDir, 'guides/before-vs-after-rbd-rules.html'),
        guide4: resolve(rootDir, 'guides/eligible-vs-non-eligible-beneficiaries.html'),
        guide5: resolve(rootDir, 'guides/state-tax-inherited-ira.html')
      }
    }
  }
});
