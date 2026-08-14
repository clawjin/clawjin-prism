with daily_orders as (
    select
        order_date,
        count(distinct order_id) as total_orders,
        count(distinct customer_id) as total_customers,
        sum(gross_revenue) as gross_revenue,
        sum(cogs) as total_cogs,
        sum(shipping_cost) as total_shipping,
        sum(net_margin) as gross_profit
    from {{ ref('stg_orders') }}
    where status = 'Completed'
    group by 1
),

daily_ads as (
    select
        ad_date,
        sum(ad_spend) as total_ad_spend,
        sum(clicks) as total_clicks,
        sum(impressions) as total_impressions
    from {{ ref('stg_ad_spend') }}
    group by 1
)

select
    coalesce(o.order_date, a.ad_date) as date,
    coalesce(o.total_orders, 0) as total_orders,
    coalesce(o.gross_revenue, 0) as total_revenue,
    coalesce(a.total_ad_spend, 0) as total_ad_spend,
    coalesce(o.gross_profit, 0) - coalesce(a.total_ad_spend, 0) as net_profit,
    case 
        when coalesce(o.total_orders, 0) > 0 
        then round(coalesce(a.total_ad_spend, 0) / o.total_orders, 2) 
        else 0 
    end as blended_cac,
    case 
        when coalesce(a.total_ad_spend, 0) > 0 
        then round(coalesce(o.gross_revenue, 0) / a.total_ad_spend, 2) 
        else 0 
    end as blended_roas
from daily_orders o
full outer join daily_ads a on o.order_date = a.ad_date
order by date desc