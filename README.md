# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Troubleshooting

### Stale component reference errors (e.g. `X is not defined`)

If the preview shows a runtime error like `ReferenceError: SomeComponent is not defined` immediately after renaming or removing a component — and a code search confirms the symbol no longer exists in the source — Vite's HMR (Hot Module Replacement) cache is serving a stale module.

**Quick fixes (in order of escalation):**

1. **Hard reload** the preview tab: `Cmd/Ctrl + Shift + R`.
2. **Restart the dev server**:
    ```sh
    # Stop with Ctrl+C, then:
    npm run dev
    ```
3. **Clear Vite's on-disk cache** if a hard reload + restart still serves stale code:
    ```sh
    rm -rf node_modules/.vite
    npm run dev
    ```
4. **Nuclear option** — wipe deps and reinstall:
    ```sh
    rm -rf node_modules/.vite node_modules/.cache
    npm ci
    npm run dev
    ```

> Working inside Lovable? Just ask the agent to "restart the dev server" — it has a dedicated tool for it and no manual cache clearing is required.
