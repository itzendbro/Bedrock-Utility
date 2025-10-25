import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace <YOUR_REPO_NAME> with the name of your GitHub repository.
  // For example, if your repository URL is https://github.com/user/my-addon-app,
  // the base should be '/my-addon-app/'.
  base: '/Bedrock-Utility/',
})
