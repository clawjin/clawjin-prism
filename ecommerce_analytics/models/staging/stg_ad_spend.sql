with source as (
    select * from {{ source('public', 'raw_ad_spend') }}
),

renamed as (
    select
        cast(date as date) as ad_date,
        channel,
        cast(spend as numeric(10,2)) as ad_spend,
        clicks,
        impressions
    from source
)

select * from renamed