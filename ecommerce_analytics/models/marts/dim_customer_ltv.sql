with customer_orders as (
    select
        customer_id,
        min(order_date) as first_order_date,
        max(order_date) as last_order_date,
        count(distinct order_id) as total_lifetime_orders,
        sum(gross_revenue) as lifetime_revenue,
        sum(net_margin) as lifetime_net_margin
    from {{ ref('stg_orders') }}
    where status = 'Completed'
    group by 1
)

select
    customer_id,
    first_order_date,
    last_order_date,
    total_lifetime_orders,
    lifetime_revenue,
    lifetime_net_margin,
    case 
        when total_lifetime_orders >= 4 then 'Champion (VIP)'
        when total_lifetime_orders >= 2 then 'Loyal Customer'
        else 'One-Time Buyer'
    end as customer_segment
from customer_orders
order by lifetime_revenue desc