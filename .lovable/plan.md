

# Add Dark Mode Support with Navigation Toggle

## What will be built

1. **ThemeProvider** — Wrap the app with `next-themes` `ThemeProvider` (already installed) to manage light/dark/system themes with `class` strategy (matches existing `darkMode: ["class"]` in tailwind config).

2. **ThemeToggle component** — A Sun/Moon icon button using `lucide-react` icons that cycles between light and dark mode. Compact, placed in a top navigation bar.

3. **Navigation bar** — A minimal top bar component on the Index page (and future pages) containing the TennisAI logo/text and the theme toggle button. This will serve as the foundation for the role-based navigation planned later.

4. **Dark mode CSS** — The dark theme variables are already defined in `index.css` (the `.dark` class block). No CSS changes needed.

## Files to create/modify

- **Create** `src/components/ThemeProvider.tsx` — Re-export `next-themes` ThemeProvider with correct defaults (`attribute="class"`, `defaultTheme="system"`)
- **Create** `src/components/ThemeToggle.tsx` — Sun/Moon toggle button using the existing Button component
- **Create** `src/components/Navbar.tsx` — Simple top navigation bar with "TennisAI" branding and the theme toggle
- **Modify** `src/App.tsx` — Wrap app content with ThemeProvider
- **Modify** `src/pages/Index.tsx` — Include the Navbar
- **Modify** `index.html` — Add `class="dark"` suppression script to prevent FOUC (flash of unstyled content)

