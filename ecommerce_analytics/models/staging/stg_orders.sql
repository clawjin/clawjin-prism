with source as (
    select * from {{ source('public', 'raw_orders') }}
),

renamed as (
    select
        order_id,
        customer_id,
        cast(order_date as timestamp) as order_timestamp,
        cast(order_date as date) as order_date,
        cast(gross_revenue as numeric(10,2)) as gross_revenue,
        cast(cogs as numeric(10,2)) as cogs,
        cast(shipping_cost as numeric(10,2)) as shipping_cost,
        acquisition_channel,
        status,
        case when status = 'Completed' then 1 else 0 end as is_completed_order,
        case when status = 'Completed' then gross_revenue - cogs - shipping_cost else 0 end as net_margin
    from source
)

select * from renamed