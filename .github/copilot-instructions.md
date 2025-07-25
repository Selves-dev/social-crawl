<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Social Crawl - Nitro Server Project

This is a Nitro server project with the following key features:

## Project Structure
- Uses Nitro framework (not Nuxt) for server-side functionality
- TypeScript for type safety
- Plugin system for initialization tasks
- RESTful API endpoints

## Key Components
1. **Service Bus Plugin** (`src/plugins/serviceBus.ts`): Startup plugin that connects to a service bus (currently simulated with logging)
2. **Health Endpoint** (`src/routes/health.get.ts`): Provides server health status and diagnostics

## Development Guidelines
- Use h3 event handlers for API routes
- Plugins should use `defineNitroPlugin` from 'nitropack/runtime'
- Event handlers should use `defineEventHandler` from 'h3'
- Follow the file-based routing convention in `src/routes/`
- All plugins go in `src/plugins/` and are auto-loaded at startup

## Future Enhancements
- Replace simulated service bus connection with actual service bus client
- Add proper error handling and retry logic for service bus connection
- Implement health checks that verify actual service dependencies
