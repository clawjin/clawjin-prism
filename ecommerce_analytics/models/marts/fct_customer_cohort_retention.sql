with customer_first_order as (
    select
        customer_id,
        date_trunc('month', min(order_date)) as cohort_month
    from {{ ref('stg_orders') }}
    where status = 'Completed'
    group by 1
),

order_activities as (
    select
        o.customer_id,
        c.cohort_month,
        date_trunc('month', o.order_date) as order_month,
        (
            (extract(year from date_trunc('month', o.order_date)) - extract(year from c.cohort_month)) * 12 +
            (extract(month from date_trunc('month', o.order_date)) - extract(month from c.cohort_month))
        ) as month_number,
        o.gross_revenue,
        o.net_margin
    from {{ ref('stg_orders') }} o
    inner join customer_first_order c on o.customer_id = c.customer_id
    where o.status = 'Completed'
),

cohort_summary as (
    select
        cohort_month,
        month_number,
        count(distinct customer_id) as active_customers,
        sum(gross_revenue) as cohort_revenue,
        sum(net_margin) as cohort_net_profit
    from order_activities
    group by 1, 2
)

select
    cohort_month,
    month_number,
    active_customers,
    cohort_revenue,
    cohort_net_profit,
    first_value(active_customers) over (partition by cohort_month order by month_number) as initial_cohort_size,
    round(
        (active_customers::numeric / nullif(first_value(active_customers) over (partition by cohort_month order by month_number), 0)) * 100, 
        2
    ) as retention_rate_pct
from cohort_summary
order by cohort_month desc, month_number asc