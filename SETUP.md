# Setup — Clean Energy Capital Stack Tool

This repo is a complete, working site plus a complete, working editor for
it. Nothing here needs code changes to go live — but six things need to
happen in the GitHub and Cloudflare web interfaces, in order, and only
someone with a GitHub account (and org permissions, if this lands under a
DCEO GitHub org) can do them. That's true of any GitHub-based setup, not a
limitation specific to this one.

Budget about 30 minutes the first time. After that, nobody touches any of
this again — editing programs is just visiting `/admin` and filling out a
form.

---

## What's in this repo

```
index.html              ← the live site (generated — don't hand-edit)
data/
  programs.json          ← the 83 programs. This is what /admin edits.
  settings.json           ← the "verified as of" date. Also CMS-edited.
  project-types.json      ← the 11 project-type filters. Edit by hand, rarely.
  audiences.json          ← the 6 client-type filters. Edit by hand, rarely.
  stacks.json              ← the three capital-stack scenarios. Edit by hand, rarely.
scripts/build.js          ← reads everything in data/, writes index.html
admin/
  index.html               ← the CMS admin app (loads from a CDN, nothing to install)
  config.yml                ← tells the CMS what's editable and where to save it
oauth-worker/
  worker.js                  ← the GitHub sign-in helper (deploys to Cloudflare)
  wrangler.toml                ← Cloudflare's deploy config for that file
.github/workflows/deploy.yml   ← rebuilds + republishes on every save
```

The only two files anyone should regularly touch after setup are
`data/programs.json` and `data/settings.json` — and normally even those
get edited through the `/admin` form, not by hand.

---

## Step 1 — Create the GitHub repository

1. On github.com, create a new **public** repository. (It has to be public
   for GitHub Pages' free tier to serve it — see the note at the bottom if
   that's a problem.)
2. Name it whatever you'd like — `clean-energy-capital-stack-tool` is what
   the config files assume, but any name works as long as you update the
   `repo:` line in `admin/config.yml` to match.
3. Upload everything in this folder to that repo, on the `main` branch.

## Step 2 — Turn on GitHub Pages

1. In the repo: **Settings → Pages**.
2. Under "Build and deployment," set **Source** to **GitHub Actions**.
   (Not "Deploy from a branch" — the workflow file in this repo handles
   the build itself.)
3. Push anything to `main` (even a no-op commit) to trigger the first
   build. Once it finishes, your URL is:

   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Step 3 — Create a GitHub OAuth App

This is what lets the CMS ask "sign in with GitHub."

1. **Settings → Developer settings → OAuth Apps → New OAuth App**
   (this is under your personal or org account settings, not the repo).
2. Fill in:
   - **Application name:** anything, e.g. "Clean Energy Tool CMS"
   - **Homepage URL:** your Pages URL from Step 2
   - **Authorization callback URL:**
     `https://REPLACE-WITH-YOUR-WORKER.workers.dev/callback`
     — you don't have this URL yet. Come back and fill this in after
     Step 4. GitHub lets you edit it later.
3. Click **Generate a new client secret**. Copy both the **Client ID**
   and the **Client Secret** somewhere safe — you'll need them in Step 5.
   The secret is shown once.

## Step 4 — Deploy the OAuth Worker to Cloudflare

1. Create a free Cloudflare account if you don't have one
   (dash.cloudflare.com).
2. **Workers & Pages → Create → Create Worker.** Give it a name.
3. Open the online editor and paste in the entire contents of
   `oauth-worker/worker.js`, replacing the placeholder code. Deploy.
4. Your Worker's URL is shown at the top, something like
   `https://clean-energy-cms-oauth.YOUR-SUBDOMAIN.workers.dev`.
5. Go back to Step 3's OAuth App and update the callback URL to
   `<that Worker URL>/callback`.

## Step 5 — Connect the OAuth App to the Worker

1. In the Cloudflare dashboard, open your Worker → **Settings → Variables**.
2. Add two **secret** variables (not plain text variables):
   - `GITHUB_CLIENT_ID` — from Step 3
   - `GITHUB_CLIENT_SECRET` — from Step 3
3. Save. No redeploy needed — secrets apply immediately.

## Step 6 — Point the CMS at your repo and Worker

1. Open `admin/config.yml` in the repo.
2. Change `repo:` to your actual `username/repo-name` from Step 1.
3. Change `base_url:` to your Worker's URL from Step 4 (no `/callback` on
   the end — just the base address).
4. Commit that change directly on GitHub (small edit, GitHub's own editor
   is fine for this one).

---

## You're done. Using it:

Go to `https://YOUR-PAGES-URL/admin`, click **Login with GitHub**,
authorize the app the first time, and you'll see two things to edit:
**Funding Programs** (the 83 program cards) and **Site Settings** (the
verified-date stamp). Edit, click **Publish**, and the live site updates
itself within about a minute — that's the GitHub Action rebuilding and
republishing automatically.

## Who can edit it

Anyone who is a **collaborator on the GitHub repo** can log in and edit.
Add or remove people under **Settings → Collaborators and teams**. That
list — not anything in this codebase — is your access control. Removing
someone from the repo removes their ability to edit immediately.

## The annual pass

Once a year (or whenever), go through `/admin → Funding Programs`,
confirm each link still resolves and each program is still open, fix
anything stale, then update **Site Settings → Programs Verified As Of**
to today's date. That date field is the whole reason `settings.json`
exists separately from the program list — one field, one place, no code.

## If "public repo" is a problem

GitHub Pages' free tier requires a public repo. If DCEO needs this on a
private repo, the GitHub Team plan supports private-repo Pages — that's
an organizational/billing decision, not a technical blocker in this setup.
Everything else here (the CMS, the Worker, the Action) works identically
either way.
