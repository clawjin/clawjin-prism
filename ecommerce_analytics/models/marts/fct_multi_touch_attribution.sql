with orders as (
    select
        order_date,
        acquisition_channel,
        gross_revenue,
        net_margin,
        order_id
    from {{ ref('stg_orders') }}
    where status = 'Completed'
),

channel_attribution as (
    select
        acquisition_channel,
        count(distinct order_id) as attributed_orders,
        sum(gross_revenue) as attributed_revenue,
        sum(net_margin) as attributed_gross_margin,
        round(avg(gross_revenue), 2) as average_order_value
    from orders
    group by 1
),

total_volume as (
    select sum(gross_revenue) as total_store_revenue from orders
)

select
    c.acquisition_channel,
    c.attributed_orders,
    c.attributed_revenue,
    c.attributed_gross_margin,
    c.average_order_value,
    round((c.attributed_revenue / nullif(t.total_store_revenue, 0)) * 100, 2) as revenue_share_pct
from channel_attribution c
cross join total_volume t
order by c.attributed_revenue desc