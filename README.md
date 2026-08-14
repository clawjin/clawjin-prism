# 🛒 Modern E-Commerce Analytics & Unit Economics Pipeline
> **Automated Modern Data Stack (MDS) implementation using dbt, PostgreSQL (Supabase), and Python.**

![dbt](https://img.shields.io/badge/dbt-v1.10-orange?logo=dbt)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue?logo=postgresql)
![Python](https://img.shields.io/badge/Python-3.11+-yellow?logo=python)

---

## 🎯 Executive Overview & Problem Statement
E-commerce brands scaling past $1M ARR often suffer from **fragmented data silos**. Order data (Shopify), customer retention, and ad spend (Meta, Google, TikTok) are trapped in isolated platforms, forcing leadership to calculate blended unit economics manually in error-prone spreadsheets.

This pipeline automates the extraction, transformation, modeling, and automated executive alerting for:
1. **Real-Time Unit Economics:** Daily Blended CAC, Contribution Margin, and Blended ROAS.
2. **Customer Lifetime Value (LTV):** RFM loyalty segmentation (Champions vs. At-Risk vs. One-Time Buyers).
3. **Monthly Cohort Retention:** 30/60/90-day repurchase rates by customer acquisition month.
4. **Automated Daily Executive Briefings:** Automated 8:00 AM KPI alerts delivered via Python webhook.

---

## 🏗️ Architecture & Data Flow

[RAW DATA SOURCES] (Shopify Orders & Multi-Channel Ad Spend)
        │
        ▼ (Python Ingestion)
[CLOUD DATA WAREHOUSE] (PostgreSQL on Supabase: raw_orders, raw_ad_spend)
        │
        ▼ (dbt Staging Models)
[ANALYTICS STAGING LAYER] (stg_orders.sql, stg_ad_spend.sql)
        │
        ▼ (dbt Business Marts)
[BUSINESS MARTS] (fct_daily_unit_economics, dim_customer_ltv, fct_customer_cohort_retention)
        │
        ▼ (Python Webhooks & Metabase / Looker Studio)
[CONSUMPTION & ALERTING] (Automated Daily Morning Executive Briefings)

---

## 📊 Core Business Metrics Calculated

| Metric | Business Definition | Formula |
| :--- | :--- | :--- |
| **Blended CAC** | True customer acquisition cost across all paid channels | Total Ad Spend / Total Completed Orders |
| **Blended ROAS** | True advertising return on revenue | Gross Revenue / Total Ad Spend |
| **Gross Profit** | True net margin after COGS & Shipping fees | Revenue - COGS - Shipping |
| **Net Contribution** | Bottom-line cash generated after ad acquisition | Gross Profit - Total Ad Spend |

---

## 🚀 Quickstart & Reproduction

### 1. Ingest Synthetic Data
- python generate_data.py
- python generate_ad_spend.py
- python load_to_postgres.py

### 2. Compile & Run dbt Models
- cd ecommerce_analytics
- dbt debug
- dbt run

### 3. Run Automated Executive Briefing
- python daily_kpi_alert.py

---
*Clawjin*