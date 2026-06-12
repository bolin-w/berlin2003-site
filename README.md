# Berlin2003 Site

This folder is the unified local working copy and Git repository for the website.

## Purpose

- edit pages and assets
- run local asset optimization
- verify deploy-ready output before pushing to GitHub or updating the server

## Key paths

- `index.html`: homepage
- `assets/`: shared CSS, JS, and images
- `projects/`, `research/`, `notes/`, `life/`, `contact/`: page sections

## Local commands

```bash
npm install
npm run build:css
npm run build:js
```

## Working rule

Treat this directory as the single source of truth for the website. Edit, verify, commit, and deploy from here.
