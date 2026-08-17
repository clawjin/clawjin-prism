with channel_orders as (
    select
        order_date,
        coalesce(acquisition_channel, 'Organic / Direct') as channel,
        count(distinct order_id) as total_orders,
        sum(gross_revenue) as attributed_revenue,
        sum(cogs) as attributed_cogs,
        sum(shipping_cost) as attributed_shipping,
        sum(gross_revenue - cogs - shipping_cost) as gross_profit
    from {{ ref('stg_orders') }}
    where status = 'Completed'
    group by 1, 2
),

channel_ads as (
    select
        ad_date,
        channel,
        sum(ad_spend) as total_ad_spend,
        sum(clicks) as clicks,
        sum(impressions) as impressions
    from {{ ref('stg_ad_spend') }}
    group by 1, 2
)

select
    coalesce(o.order_date, a.ad_date) as date,
    coalesce(o.channel, a.channel) as channel,
    coalesce(o.total_orders, 0) as total_orders,
    coalesce(o.attributed_revenue, 0) as attributed_revenue,
    coalesce(a.total_ad_spend, 0) as channel_ad_spend,
    coalesce(o.attributed_cogs, 0) as attributed_cogs,
    coalesce(o.attributed_shipping, 0) as attributed_shipping,
    (coalesce(o.gross_profit, 0) - coalesce(a.total_ad_spend, 0)) as channel_net_profit,
    case 
        when coalesce(a.total_ad_spend, 0) > 0 
        then round(coalesce(o.attributed_revenue, 0) / a.total_ad_spend, 2) 
        else 0 
    end as channel_roas,
    case
        when coalesce(o.total_orders, 0) > 0 and coalesce(a.total_ad_spend, 0) > 0
        then round(coalesce(a.total_ad_spend, 0) / o.total_orders, 2) 
        else 0 
    end as channel_cac
from channel_orders o
full outer join channel_ads a on o.order_date = a.ad_date and o.channel = a.channel
order by date desc, channel_net_profit desc