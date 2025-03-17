# CLAUDE.md - Red Light, Green Light Game

## Commands
- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Code Style Guidelines
- **TypeScript**: Use strict typing with interfaces for data structures
- **React**: Functional components with hooks, avoid class components
- **State Management**: Use Zustand for global state (see `gameStore.ts`)
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Imports**: Group by external libraries first, then internal modules
- **Formatting**: 2-space indentation, semi-colons, trailing commas
- **CSS**: Use Tailwind with the `cn()` utility for class name merging
- **Error Handling**: Use try/catch with specific error logging
- **JSDoc**: Use for complex functions (see `utils.ts`)
- **Dependencies**: Keep modules focused with single responsibility
- **Testing**: (No tests currently implemented)

## Project Structure
- `/src/components/` - React UI components
- `/src/store/` - Zustand state management
- `/src/lib/` - Utility functions and helpers