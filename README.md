# Clean Energy Capital Stack Tool

Illinois DCEO — Office of Energy and Business Utilization

A single static page (`index.html`) mapping Illinois clean energy funding
programs to project types and client types, generated from the JSON files
in `data/`.

**Setting this up for the first time?** Start with `SETUP.md` — six
one-time steps, about 30 minutes.

**Just here to edit a program or a link?** Go to `/admin` on the live
site and log in with GitHub. See `SETUP.md`'s "Using it" section.

## Local development

No dependencies, no build tools required beyond Node.js itself.

```
node scripts/build.js
```

regenerates `index.html` from everything in `data/`. Open it directly in
a browser to preview.
