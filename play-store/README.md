# Play Store Assets

## Files

| File | Purpose | Required size |
|------|---------|--------------|
| `icon.svg` → `icon.png` | App icon | 512 × 512 PNG |
| `feature-graphic.svg` → `feature-graphic.png` | Feature graphic | 1024 × 500 PNG |
| `screenshots/1-trips.html` | Trips list | Screenshot at 390 × 844 |
| `screenshots/2-activities.html` | Activity voting | Screenshot at 390 × 844 |
| `screenshots/3-expenses.html` | Expense splitting | Screenshot at 390 × 844 |
| `screenshots/4-documents.html` | Travel documents | Screenshot at 390 × 844 |
| `listing.md` | Store listing text | — |
| `../docs/privacy-policy.html` | Privacy policy | Host on GitHub Pages |

## Convert SVGs to PNG

```bash
npm exec sharp-cli -- --input icon.svg --output icon.png --width 512 --height 512
npm exec sharp-cli -- --input feature-graphic.svg --output feature-graphic.png --width 1024 --height 500
```

## Screenshot mockups

Open each HTML file in Chrome:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Set custom dimensions: 390 × 844
4. Take a full-page screenshot (DevTools → ⋮ → Capture screenshot)

For 2× resolution (recommended): set Device Pixel Ratio to 2 in DevTools → you get 780 × 1688 which
is well within Play Store limits and looks sharper.

## Privacy policy

Deploy `../docs/privacy-policy.html` to GitHub Pages. Then:
1. Fill in your name and contact email in the file (search for `[Your Full Name]` / `[contact@yourdomain.com]`)
2. Register the live URL in Google Play Console → Store listing → Privacy policy URL
3. Update the `listing.md` Privacy Policy URL placeholder with the live URL
