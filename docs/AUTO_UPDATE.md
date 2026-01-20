# Auto-Update & Release System

## Overview

The launcher automatically fetches the latest version from GitHub Releases, ensuring users always have the most up-to-date version.

## How It Works

### 1. Go Launcher Auto-Update

When `launcher.exe` runs:

1. Checks if `bin/index.js` exists
2. If not, calls GitHub API: `https://api.github.com/repos/sakatimuna7/printer-http-service/releases/latest`
3. Downloads `app-bundle.zip` from the latest release
4. Extracts it to `bin/` folder
5. Runs the service

### 2. Creating a New Release

Simply run:

```bash
bun run release
```

This will:

1. Auto-bump version (e.g., `1.0.0` → `1.0.1`)
2. Update `package.json`
3. Build `dist/app-bundle.zip`
4. Commit version bump to git
5. Create git tag `v1.0.1`
6. Push to GitHub

Then you need to **manually create the GitHub Release**:

1. Go to: https://github.com/sakatimuna7/printer-http-service/releases/new
2. Select the tag that was just created (e.g., `v1.0.2`)
3. Upload `dist/app-bundle.zip` as an asset
4. Click "Publish release"

### Optional: Auto-Release with GitHub CLI

If you install GitHub CLI, the process will be fully automated:

```bash
brew install gh
gh auth login
```

Then `bun run release` will create the GitHub Release automatically.

## Requirements

- **Git**: Already configured with your repo

## Usage

### First Release

```bash
# Make sure you're on main branch
git checkout main

# Create the first release
bun run release
```

### Subsequent Releases

```bash
# Just run release whenever you want to publish
bun run release
```

The version will auto-increment: `1.0.0` → `1.0.1` → `1.0.2` → etc.

## Manual Version Bump

If you want to bump major or minor versions, edit `package.json` manually:

```json
{
  "version": "2.0.0" // Change this
}
```

Then run `bun run release` as usual.

## Distribution

After creating a release, users can:

1. Download `launcher.exe` (8.4MB) once
2. Run it - it will auto-download the latest `app-bundle.zip` (3.2MB)
3. Future updates: Just create a new release, launcher will auto-update!

## Troubleshooting

**Error: `gh: command not found`**

- Install GitHub CLI: `brew install gh`
- Authenticate: `gh auth login`

**Error: `GitHub API returned status 404`**

- Make sure you've created at least one release
- Check that `REPO_OWNER` and `REPO_NAME` in `launchers/go/main.go` are correct
