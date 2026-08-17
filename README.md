# Clawjin Prism™ — Unit Economics Engine

Real-time e-commerce unit economics, delivered as a complete web app:

- **Blended CAC, Blended ROAS, Contribution Margin 1 & 2**
- **Monthly cohort repurchase (retention) matrix**
- **RFM loyalty segmentation** (VIP → Lost)
- **Daily executive briefing** with automated alerts
- **Signup, login, demo login** and a full client dashboard
- Every new workspace is seeded with a realistic demo dataset so it works instantly

> Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, PostgreSQL + Drizzle ORM, Recharts.

---

## Run locally

```bash
npm install
cp .env.example .env            # defaults to a local Postgres instance
npx drizzle-kit migrate         # create the database schema
npm run dev                     # http://localhost:3000
```

---

## 🚀 Make it public — deploy for $0

You need **two free accounts**: [Neon](https://neon.tech) (free PostgreSQL) and [Vercel](https://vercel.com) (free hosting). Everything below is on their free tiers.

### 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "Clawjin Prism launch"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/clawjin-prism.git
git push -u origin main
```

> The `.gitignore` already excludes `.env` and `node_modules`, so your secrets stay private. The `drizzle/` migration folder **is** committed — that's intentional.

### 2. Create a free Neon database

1. Go to [neon.tech](https://neon.tech) → **Sign up** (GitHub login works).
2. Create a project → pick any region close to you.
3. On the dashboard, copy the **Pooled connection string**. It looks like:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`
4. Save it — this is your `DATABASE_URL`.

### 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up** (GitHub login works).
2. **Add New → Project** → import your `clawjin-prism` repo.
3. Framework should auto-detect as **Next.js**.
4. Set **Environment Variables**:
   - `DATABASE_URL` → your Neon pooled connection string
   - `NEXT_PUBLIC_SITE_URL` → `https://your-project.vercel.app` (you'll know the exact URL after the first deploy; you can update it later)
5. Expand **Build and Output Settings** and set the **Build Command** to:
   ```
   npx drizzle-kit migrate && next build
   ```
   This creates/updates your database schema automatically on every deploy.
6. Click **Deploy**.

### 4. Verify it's live

1. Open your `https://your-project.vercel.app` URL.
2. Click **Explore live demo** (one-click demo workspace) or **Start free trial** to create a real account.
3. You should land in the dashboard with live unit-economics charts.

✅ Done — anyone can now sign up and use it.

---

## 🏷️ Custom domain (optional, ~$10/yr)

The free `*.vercel.app` URL works fine to start. When ready, buy a domain (Namecheap, Cloudflare, etc.) and add it in **Vercel → your project → Settings → Domains**. Then update `NEXT_PUBLIC_SITE_URL` to your custom domain.

---

## 💰 Payments & billing (built in)

Billing is fully wired up: a **Billing** page in the dashboard, Stripe Checkout
subscriptions, plan gating, payment history, and a webhook that upgrades accounts
automatically when a payment completes.

**Plans (prices in USD):**

| Plan | Price |
|------|-------|
| Trial | Free (14 days) |
| Pro | **$499 / month** (or $4,990 / year) |
| Enterprise | Custom |

**Demo mode (no Stripe keys):** everything works out of the box with simulated
payments — the "Upgrade to Pro" button upgrades the account instantly. Useful for
testing before you connect Stripe.

**Go live with real payments:**

1. Create a [Stripe](https://stripe.com) account.
2. Create two **recurring Prices** for Pro ($499/mo and $4,990/yr) in the Stripe dashboard.
3. Add these env vars on Vercel:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_ANNUAL_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET` (from `stripe listen` or the Stripe dashboard)
4. Point the webhook at `https://your-app.vercel.app/api/stripe/webhook` with events:
   `checkout.session.completed` and `customer.subscription.deleted`.

When a customer pays, the webhook upgrades them to Pro, logs the payment, and
unlocks gated features (unlimited data sources + CSV export).

---

## 📈 Roadmap

- Stripe checkout + plan upgrade webhooks
- Password reset emails (Resend free tier)
- Client CSV upload to ingest real Shopify / ads data
- Admin panel to manage all client workspaces
- Rate limiting & abuse protection

---

## Security notes

- Passwords are hashed with Node's built-in `scrypt` (no plaintext, no paid auth service).
- Sessions use `httpOnly` + `SameSite` cookies.
- Each workspace is isolated by `user_id`.
- TLS is enabled automatically for any non-local database URL.
