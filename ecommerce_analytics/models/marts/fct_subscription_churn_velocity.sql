with customer_orders as (
    select
        customer_id,
        order_date,
        gross_revenue,
        order_id,
        status,
        row_number() over (partition by customer_id order by order_date asc) as order_sequence
    from {{ ref('stg_orders') }}
    where status = 'Completed'
),

cycle_dropoffs as (
    select
        order_sequence,
        count(distinct customer_id) as active_subscribers,
        sum(gross_revenue) as cycle_gross_revenue,
        round(avg(gross_revenue), 2) as average_cycle_value
    from customer_orders
    where order_sequence <= 6
    group by 1
),

cohort_base as (
    select count(distinct customer_id) as total_initial_subscribers
    from customer_orders
    where order_sequence = 1
)

select
    c.order_sequence as subscription_cycle,
    c.active_subscribers,
    c.cycle_gross_revenue,
    c.average_cycle_value,
    round((c.active_subscribers::numeric / nullif(b.total_initial_subscribers, 0)) * 100, 2) as cycle_retention_pct,
    round(
        100.0 - ((c.active_subscribers::numeric / nullif(lag(c.active_subscribers, 1) over (order by c.order_sequence), 0)) * 100), 
        2
    ) as cycle_churn_rate_pct
from cycle_dropoffs c
cross join cohort_base b
order by c.order_sequence asc