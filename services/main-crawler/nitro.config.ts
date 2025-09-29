import { defineNitroConfig } from 'nitropack/config'
import { config } from 'dotenv'
import { join } from 'path'

// Load environment variables from root .env files
config({ path: join(process.cwd(), '../../.env') })
config({ path: join(process.cwd(), '../../.env.local'), override: true })

export default defineNitroConfig({
  srcDir: 'src',
  compatibilityDate: '2025-09-29',
  // Ensure environment variables are available in runtime
  runtimeConfig: {
    // Private keys (only available on server-side)
    azureServiceBusConnectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
    apiToken: process.env.API_TOKEN,
    messageSecurityToken: process.env.MESSAGE_SECURITY_TOKEN,
    // Public keys (exposed to client-side)
    public: {
      apiBase: '/api'
    }
  }
})