# 🔮 Clawjin Prism™
### Enterprise Modern Data Stack & Real-Time E-Commerce Unit Economics Engine

[![Clawjin Core](https://img.shields.io/badge/Enterprise-Clawjin%20Core-indigo?style=for-the-badge&logo=appveyor)](https://github.com/clawjin)
[![dbt Core](https://img.shields.io/badge/dbt-v1.10+-orange?style=for-the-badge&logo=dbt)](https://docs.getdbt.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue?style=for-the-badge&logo=postgresql)](https://supabase.com)
[![Python](https://img.shields.io/badge/Python-3.11+-yellow?style=for-the-badge&logo=python)](https://python.org)
[![Status](https://img.shields.io/badge/Status-Production%20Active-emerald?style=for-the-badge)]()

---

## 🎯 Executive Overview & Commercial Value

**Clawjin Prism™** is a proprietary analytics and data orchestration engine engineered specifically for high-growth e-commerce brands scaling from **$1M to $50M+ ARR**.

Modern direct-to-consumer brands suffer from **data fragmentation**. Transactional orders (Shopify), multi-channel advertising spend (Meta, Google, TikTok), and recurring retention metrics are isolated in closed silos. Founders and executive teams waste 15+ hours weekly calculating blended metrics in vulnerable, disconnected spreadsheets.

**Clawjin Prism™ automates the entire end-to-end data pipeline:**
* **Continuous Ingestion:** High-throughput transactional data extraction into dedicated cloud PostgreSQL infrastructure.
* **Deterministic dbt Modeling:** Automated transformation marts for Blended CAC, Contribution Margin 1 & 2, and RFM loyalty segmentation.
* **Monthly Cohort Repurchase Matrix:** Dynamic 30/60/90-day retention curve modeling.
* **Executive Alerting Engine:** Automated 8:00 AM daily Slack briefings delivering verified KPI scorecards directly to leadership.

---

## 🏗️ Enterprise Architecture & Data Flow

```
  ┌───────────────────────────────────────────────────────────┐
  │ TRANSACTIONAL & AD INGESTION LAYER                        │
  │ • Shopify Orders, COGS & Fulfillment Stream               │
  │ • Multi-Channel Paid Media (Meta, Google, TikTok Ads)     │
  └─────────────────────────────┬─────────────────────────────┘
                                │ (Automated Ingestion)
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ CLOUD DATA WAREHOUSE (Supabase Enterprise PostgreSQL)     │
  │ Isolated Raw Schemas: public.raw_orders | public.raw_ads  │
  └─────────────────────────────┬─────────────────────────────┘
                                │ (dbt Transformation Core)
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ ANALYTICS STAGING & MART MODELS                           │
  │ • stg_orders.sql / stg_ad_spend.sql                       │
  │ • fct_daily_unit_economics.sql (Blended CAC & ROAS)       │
  │ • dim_customer_ltv.sql (RFM VIP Segmentation)             │
  │ • fct_customer_cohort_retention.sql (Repurchase Curves)   │
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │ EXECUTIVE CONSUMPTION & TELEMETRY                         │
  │ • Automated 8:00 AM Slack Intelligence Briefing (Python)  │
  │ • Real-Time Business Intelligence & Executive Dashboard   │
  └───────────────────────────────────────────────────────────┘
```

---

## 📊 Core Business Intelligence Metrics

| Metric | Enterprise Definition | Mathematical Formulation |
| :--- | :--- | :--- |
| **Blended CAC** | True acquisition cost across all blended channels | `Total Multi-Channel Ad Spend / Completed Orders` |
| **Blended ROAS** | True advertising return on aggregate revenue | `Gross Order Revenue / Total Ad Spend` |
| **Contribution Margin** | Net bottom-line cash generated post-fulfillment & ads | `Gross Profit (Rev - COGS - Shipping) - Ad Spend` |
| **Cohort Retention Rate** | Percentage of customers repurchasing by monthly lag | `(Active Cohort Users / Initial Cohort Size) * 100` |

---

## 🚀 Engine Deployment & Execution

### 1. Ingestion Pipeline
```bash
python generate_data.py
python generate_ad_spend.py
python load_to_postgres.py
```

### 2. Compile & Run dbt Marts
```bash
cd ecommerce_analytics
dbt debug
dbt run
```

### 3. Dispatch Automated Daily Executive Briefing
```bash
python daily_kpi_alert.py
```

---

## 🏢 Enterprise Support & Ownership

**Clawjin Prism™** is proprietary software designed, deployed, and maintained by **Clawjin Operations & Engineering**.

* **Website:** [clawjin.com](https://github.com/clawjin)
* **Product:** Clawjin Prism™ Enterprise Data Engine
* **License:** Proprietary Enterprise Software by Clawjin
