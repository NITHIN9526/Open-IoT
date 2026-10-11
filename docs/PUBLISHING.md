# Publish this source on GitHub

This archive contains a clean source project, not your running database or private settings. Use this clean folder for first publication rather than uploading the working milestone folder with its .env and backups. Your existing installation can keep running separately.

## 1. Prepare the folder

Extract the ZIP and open the inner `open-iot` folder (the one with README.md/package.json). Include dotfiles such as .gitignore and the .github folder. Do not commit node_modules, .env, .device.env, firmware secrets.h, screenshots containing personal information, .pio builds, database dumps or .upgrade-backups.

Review README.md, LICENSE and SECURITY.md. The MIT notice is retained. Add your own author attribution if desired without removing existing notices. The package name remains open-iot-milestone-1 for upgrade compatibility; it need not match the GitHub repository name. No repository URL is hardcoded because your GitHub username/repository has not been supplied.

## 2. Validate

```sh
npm ci
npm test
npm run build
npm run check:release
```

Optional browser validation:

```sh
npx playwright install chromium --only-shell
npm run test:browser
```

## 3. Create an empty repository

On GitHub, create a repository such as `open-iot`. Choose Public when you are ready to publish. Do not initialize it with another README, license or .gitignore; this folder already contains them. Copy the repository HTTPS URL. Repository creation/publication is your action; it has not been performed by this package.

## 4. Commit and push

From the clean open-iot folder:

```sh
git init -b main
git add .
git status --short
git diff --cached --stat
npm run check:release
git diff --cached
```

Review staged content, not just filenames. Then:

```sh
git commit -m "Initial release: Open IoT 5.1"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the placeholder URL. Authenticate using GitHub's supported sign-in flow; do not paste a personal access token into a committed file or command URL. If Git asks for user.name/user.email, configure your preferred author identity; a GitHub-provided no-reply email can keep your email private.

## 5. Repository settings

- Review the Actions tab. CI is configured but its first hosted run occurs only after you push.
- Enable private vulnerability reporting before inviting reports, if available for your repository. SECURITY.md explains the fallback.
- Enable appropriate secret scanning/push protection options available to your repository.
- Set branch protection/rules to require CI and review before merges if collaborating.
- Add description/topics and create a release tag only after CI is green. Do not publish private configuration as release assets.
- Dependabot is configured for npm and GitHub Actions; review and test its updates rather than merging blindly.

Publishing code does not deploy the app. GitHub Pages is static hosting and cannot run the Node server, PostgreSQL or MQTT broker. Users self-host by following README.md.

If a credential is accidentally pushed: revoke/rotate it immediately, then remove it from history using a reviewed recovery procedure. Deleting the current file or making the repository private does not undo exposure.
