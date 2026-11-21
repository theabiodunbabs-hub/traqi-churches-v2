# The landing page: how to put it live

No database changes this time.

## 1. Upload to GitHub

Replace these in your repository with the ones in this zip:
- the `src` folder
- the `public` folder (it now has a `landing` folder with the photos and the share picture)
- **`package.json` AND `package-lock.json`** (there's one new package, `lenis`, for the smooth scrolling)

## 2. Two optional settings in Vercel

Vercel › your project › Settings › Environment Variables:
- `NEXT_PUBLIC_SITE_URL`: your address once you have a domain, e.g. `https://traqi.app`. It makes the share picture work everywhere. Until then Vercel's own address is used automatically.
- `NEXT_PUBLIC_DEMO_URL`: only if you set up a separate demo copy of Traqi later. A "Try the sample church" button appears when it's set.

Redeploy after adding either.

## 3. Check it

- Open your address while signed out: the landing page shows.
- **Get started** opens church sign-up; **Log in** opens sign-in (Google or email).
- Sign in, then open the main address again: you go straight to your Home.
- Share the link on WhatsApp: the preview shows the hero picture.
