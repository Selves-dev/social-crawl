import { defineNitroPlugin } from 'nitropack/runtime'
import { config } from 'dotenv'

export default defineNitroPlugin(() => {
  config()
})
