import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'
import { builtinModules } from 'module'

// Anything Electron resolves at runtime must stay external. Listing
// rollupOptions.external replaces the plugin's defaults, so 'electron' and the
// node builtins have to be repeated here or they get bundled — which leaves
// `app` undefined at startup. Native DB drivers must stay external too.
const EXTERNALS = [
  'electron',
  'better-sqlite3',
  'pg',
  'mysql2',
  'mysql2/promise',
  'mssql',
  'oracledb',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'src/electron/main.ts',
        vite: {
          build: {
            lib: {
              entry: 'src/electron/main.ts',
              formats: ['cjs'],
              fileName: () => 'main.cjs',
            },
            rollupOptions: {
              external: EXTERNALS,
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'src/electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
              },
            },
          },
        },
      },
      // Ployfill the Electron and Node.js built-in modules for Renderer process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
