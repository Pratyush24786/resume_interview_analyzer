# CareerMatch Pro — GitHub Pages product

A free-to-host résumé and job-description matching website. It runs fully in the browser: résumé files are not uploaded to a server.

## Publish on GitHub Pages

1. Create a **public** GitHub repository, for example `careermatch`.
2. Upload all files from this folder to the repository root. Do not upload the ZIP itself.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**, then `main` and `/ (root)`; alternatively, put these files in a `docs` folder and choose `/docs`.
5. Click **Save** and wait a few minutes for the site address.

## How to start earning

1. First test the website with real users and collect feedback.
2. Offer a paid service such as a personal résumé review or mock interview, rather than selling automated results that may be inaccurate.
3. Open `config.js`, add your own verified payment, booking, WhatsApp, or email link to `personalisedHelpUrl`, and upload the changed file. The "Want a human review?" offer will then appear in every report.
4. Before accepting résumés from others, publish a privacy policy and add your business contact details.

## Important limits

- The score is a simple skill-keyword comparison, not a hiring decision or ATS guarantee.
- Scanned/image-only PDFs need OCR before their text can be read.
- A static GitHub Pages site cannot safely run its own payment system, user accounts, or private database. Use a verified payment/booking provider for those tasks.
