with daily_velocity as (
    select
        acquisition_channel,
        count(distinct order_id) as total_units_sold,
        count(distinct order_date) as active_days,
        round(count(distinct order_id)::numeric / nullif(count(distinct order_date), 0), 2) as daily_burn_velocity,
        sum(gross_revenue) as total_channel_revenue
    from {{ ref('stg_orders') }}
    where status = 'Completed'
    group by 1
)

select
    acquisition_channel,
    total_units_sold,
    daily_burn_velocity,
    total_channel_revenue,
    case
        when daily_burn_velocity > 15 then 'High Velocity (Scale Ad Budget)'
        when daily_burn_velocity > 5 then 'Moderate Velocity'
        else 'Low Velocity (Needs Creative Refresh)'
    end as operational_status
from daily_velocity
order by daily_burn_velocity desc