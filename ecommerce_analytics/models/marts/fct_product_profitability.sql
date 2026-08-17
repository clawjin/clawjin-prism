with order_line_items as (
    select
        order_id,
        customer_id,
        order_date,
        gross_revenue,
        cogs,
        shipping_cost,
        acquisition_channel,
        status,
        case when status = 'Refunded' then 1 else 0 end as is_refunded,
        case when status = 'Completed' then gross_revenue - cogs - shipping_cost else - (cogs + shipping_cost) end as net_contribution
    from {{ ref('stg_orders') }}
),

product_sku_aggregation as (
    select
        acquisition_channel,
        count(distinct order_id) as total_orders_placed,
        sum(case when status = 'Completed' then 1 else 0 end) as completed_orders,
        sum(is_refunded) as refunded_orders,
        round((sum(is_refunded)::numeric / nullif(count(distinct order_id), 0)) * 100, 2) as refund_rate_pct,
        sum(gross_revenue) as gross_revenue_volume,
        sum(cogs) as total_cogs,
        sum(shipping_cost) as total_shipping,
        sum(net_contribution) as total_net_profit,
        round((sum(net_contribution) / nullif(sum(gross_revenue), 0)) * 100, 2) as net_profit_margin_pct
    from order_line_items
    group by 1
)

select * from product_sku_aggregation
order by total_net_profit desc