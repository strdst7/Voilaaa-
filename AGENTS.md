# Voilaa Workspace Guidelines for AI Coding Agents

Welcome! Please adhere strictly to the following architectural constraints to prevent compilation conflicts, path-resolution errors, and deployment failures.

---

## ⛔ CRITICAL DEPLOYMENT CONSTRAINTS (DO NOT ALTER)

### 1. Unified Server Strategy & Runtime
- **Dev and Start Scripts**: The server and client must coordinate through the script hooks defined in `package.json`.
  - ALWAYS use `"dev": "tsx server.ts"` for development.
  - ALWAYS use `"start": "tsx server.ts"` for runtime startup. The environment relies on typescript execution directly via `tsx`. Do NOT change it to `"node server.ts"` or custom bundled locations unless requested.

### 2. Express Routing Path Restrictions (Very Sensitive ⚠️)
- **Do NOT utilize `(.*)` routing patterns**. Express and the package `path-to-regexp` in this Workspace will throw runtime errors on start like:
  `PathError [TypeError]: Unexpected ( at index 0: (.*)`
- **Correct Wildcard Patterns**: Only use `"/*"` or `"*all"` to cover SPA index fallbacks:
  ```typescript
  app.get('*all', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  ```

---

## 💻 DEVELOPMENT WORKFLOW

### Dependencies
- Before introducing a new import statement, always check `package.json`.
- Install new libraries only when explicitly required by using `install_applet_package`.

### Safety with Environment Variables
- Keep secret keys like `GEMINI_API_KEY` on the **server-side only** inside `server.ts` or `/lib/textGeneration.ts`.
- Public configurations can reside inside `.env.example`. Do NOT expose access secrets over `VITE_` variables to the client bundle.
