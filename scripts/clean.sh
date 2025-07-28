#!/bin/sh
# Clean build artifacts for Nitro/Node projects
rm -rf .output dist node_modules
rm -rf coverage
rm -rf build
rm -rf tmp
rm -rf .next
rm -rf .nuxt
rm -rf .turbo
rm -rf .cache
rm -rf .vite
rm -rf .vercel
rm -rf .svelte-kit
rm -rf .pnpm-store
rm -rf .eslintcache
rm -rf .tsbuildinfo
rm -rf yarn.lock package-lock.json
rm -rf .env.local .env.development.local .env.production.local
