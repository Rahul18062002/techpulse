// Loads .env when there is one (your own machine). On a host such as Embarko there is no .env:
// the same keys come from the host's own settings, so a missing file is not an error.
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')
