-- ============================================================
-- Scalability: server-side aggregation RPCs + incremental sync
-- Replaces unlimited client-side queries in useOrders,
-- useCityAndCustomerStats, and useCustomerRFM.
-- ============================================================

-- Incremental sync timestamp on shopify_connections
ALTER TABLE shopify_connections
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ============================================================
-- get_order_stats
-- Replaces unlimited summary query + computeStats() in useOrders.
-- Returns all temporal stats as JSON — zero order rows transferred.
-- ============================================================
CREATE OR REPLACE FUNCTION get_order_stats(
  p_workspace_id uuid,
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cutoffs AS (
    SELECT
      now() - interval '7 days'                                  AS week1,
      now() - interval '14 days'                                 AS week2,
      date_trunc('month', now())                                 AS this_month,
      date_trunc('month', now()) - interval '1 month'            AS last_month
  ),
  filtered AS (
    SELECT
      revenue,
      refund_amount,
      status,
      created_at,
      fulfillment_status,
      EXTRACT(DOW  FROM created_at)::int  AS dow,
      EXTRACT(HOUR FROM created_at)::int  AS hr,
      created_at::date                    AS day
    FROM orders
    WHERE workspace_id = p_workspace_id
      AND (p_from IS NULL OR created_at >= p_from)
      AND (p_to   IS NULL OR created_at <= p_to)
  ),
  agg AS (
    SELECT
      COUNT(*)                                                                                                                                        AS order_count,
      COALESCE(SUM(revenue),       0)                                                                                                                AS total_revenue,
      COALESCE(SUM(refund_amount), 0)                                                                                                                AS total_refunds,
      COALESCE(SUM(revenue)       FILTER (WHERE created_at >= (SELECT week1 FROM cutoffs)),                                                        0) AS this_week_revenue,
      COALESCE(SUM(revenue)       FILTER (WHERE created_at >= (SELECT week2 FROM cutoffs) AND created_at < (SELECT week1 FROM cutoffs)),           0) AS last_week_revenue,
      COALESCE(SUM(refund_amount) FILTER (WHERE created_at >= (SELECT week1 FROM cutoffs)),                                                        0) AS this_week_refunds,
      COALESCE(SUM(refund_amount) FILTER (WHERE created_at >= (SELECT week2 FROM cutoffs) AND created_at < (SELECT week1 FROM cutoffs)),           0) AS last_week_refunds,
      COALESCE(SUM(revenue)       FILTER (WHERE created_at >= (SELECT this_month FROM cutoffs)),                                                   0) AS this_month_revenue,
      COALESCE(SUM(revenue)       FILTER (WHERE created_at >= (SELECT last_month FROM cutoffs) AND created_at < (SELECT this_month FROM cutoffs)), 0) AS last_month_revenue,
      COALESCE(SUM(revenue)       FILTER (WHERE status = 'pending'),                0) AS cod_revenue,
      COALESCE(SUM(revenue)       FILTER (WHERE status IN ('paid','fulfilled')),    0) AS prepaid_revenue,
      COUNT(*)                    FILTER (WHERE status = 'pending')                    AS cod_count,
      COUNT(*)                    FILTER (WHERE status IN ('paid','fulfilled'))        AS prepaid_count,
      COUNT(*)                    FILTER (WHERE fulfillment_status = 'returned')       AS rto_count,
      COALESCE(SUM(revenue)       FILTER (WHERE fulfillment_status = 'returned'),   0) AS rto_revenue,
      COUNT(*)                    FILTER (WHERE fulfillment_status = 'returned' AND created_at >= (SELECT week1 FROM cutoffs))                        AS this_week_rto,
      COUNT(*)                    FILTER (WHERE fulfillment_status = 'returned' AND created_at >= (SELECT week2 FROM cutoffs) AND created_at < (SELECT week1 FROM cutoffs)) AS last_week_rto
    FROM filtered
  ),
  day_rev AS (
    SELECT dow, COALESCE(SUM(revenue), 0) AS rev FROM filtered GROUP BY dow
  ),
  hourly_ord AS (
    SELECT hr, COUNT(*)::int AS cnt FROM filtered GROUP BY hr
  ),
  hourly_rto AS (
    SELECT hr, COUNT(*)::int AS cnt FROM filtered WHERE fulfillment_status = 'returned' GROUP BY hr
  ),
  -- Sparkline always covers last 7 calendar days regardless of date range filter
  sparkline AS (
    SELECT created_at::date AS day, COALESCE(SUM(revenue - refund_amount), 0) AS net
    FROM orders
    WHERE workspace_id = p_workspace_id
      AND created_at::date >= (now() - interval '6 days')::date
    GROUP BY created_at::date
    ORDER BY day
  )
  SELECT json_build_object(
    'orderCount',       (SELECT order_count        FROM agg),
    'totalRevenue',     (SELECT total_revenue      FROM agg),
    'totalRefunds',     (SELECT total_refunds      FROM agg),
    'thisWeekRevenue',  (SELECT this_week_revenue  FROM agg),
    'lastWeekRevenue',  (SELECT last_week_revenue  FROM agg),
    'thisWeekRefunds',  (SELECT this_week_refunds  FROM agg),
    'lastWeekRefunds',  (SELECT last_week_refunds  FROM agg),
    'thisMonthRevenue', (SELECT this_month_revenue FROM agg),
    'lastMonthRevenue', (SELECT last_month_revenue FROM agg),
    'codRevenue',       (SELECT cod_revenue        FROM agg),
    'prepaidRevenue',   (SELECT prepaid_revenue    FROM agg),
    'codCount',         (SELECT cod_count          FROM agg),
    'prepaidCount',     (SELECT prepaid_count      FROM agg),
    'rtoCount',         (SELECT rto_count          FROM agg),
    'rtoRevenue',       (SELECT rto_revenue        FROM agg),
    'thisWeekRtoCount', (SELECT this_week_rto      FROM agg),
    'lastWeekRtoCount', (SELECT last_week_rto      FROM agg),
    'dayRevenue',    (SELECT COALESCE(json_object_agg(dow, rev),  '{}') FROM day_rev),
    'hourlyOrders',  (SELECT COALESCE(json_object_agg(hr,  cnt),  '{}') FROM hourly_ord),
    'hourlyRto',     (SELECT COALESCE(json_object_agg(hr,  cnt),  '{}') FROM hourly_rto),
    'sparkline',     (SELECT COALESCE(json_agg(json_build_object('date', day, 'net', net)), '[]'::json) FROM sparkline)
  );
$$;

GRANT EXECUTE ON FUNCTION get_order_stats(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- get_city_stats
-- Replaces full orders scan + JS Map aggregation in useCityAndCustomerStats.
-- Returns one row per city — only counts and sums, no raw rows.
-- ============================================================
CREATE OR REPLACE FUNCTION get_city_stats(
  p_workspace_id uuid,
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL
)
RETURNS TABLE(city text, order_count bigint, total_revenue numeric, rto_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    LOWER(o.city)                                                        AS city,
    COUNT(*)                                                             AS order_count,
    COALESCE(SUM(o.revenue), 0)                                         AS total_revenue,
    COUNT(*) FILTER (WHERE o.fulfillment_status = 'returned')           AS rto_count
  FROM orders o
  WHERE o.workspace_id = p_workspace_id
    AND o.city IS NOT NULL
    AND o.city <> ''
    AND (p_from IS NULL OR o.created_at >= p_from)
    AND (p_to   IS NULL OR o.created_at <= p_to)
  GROUP BY LOWER(o.city)
  ORDER BY total_revenue DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_city_stats(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- get_customer_stats
-- Replaces full orders scan + JS Map aggregation for customer metrics.
-- Returns repeat rate, top customers, new customer count as JSON.
-- ============================================================
CREATE OR REPLACE FUNCTION get_customer_stats(
  p_workspace_id uuid,
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH in_range AS (
    SELECT
      customer_id,
      customer_email,
      SUM(revenue)  AS revenue,
      COUNT(*)      AS order_count
    FROM orders
    WHERE workspace_id = p_workspace_id
      AND customer_id IS NOT NULL
      AND (p_from IS NULL OR created_at >= p_from)
      AND (p_to   IS NULL OR created_at <= p_to)
    GROUP BY customer_id, customer_email
  ),
  totals AS (
    SELECT
      COUNT(*)                                                           AS total_customers,
      COALESCE(SUM(revenue), 0)                                         AS total_revenue,
      COUNT(*) FILTER (WHERE order_count > 1)                          AS repeat_customers,
      COALESCE(SUM(revenue) FILTER (WHERE order_count > 1), 0)         AS repeat_revenue
    FROM in_range
  ),
  top5 AS (
    SELECT customer_email, order_count::int AS order_count, revenue AS total_spend
    FROM in_range
    ORDER BY revenue DESC
    LIMIT 5
  ),
  prior_ids AS (
    SELECT DISTINCT customer_id
    FROM orders
    WHERE workspace_id = p_workspace_id
      AND customer_id IS NOT NULL
      AND p_from IS NOT NULL
      AND created_at < p_from
  )
  SELECT json_build_object(
    'repeatRate',
      CASE WHEN (SELECT total_customers FROM totals) > 0
        THEN (SELECT repeat_customers::numeric / total_customers * 100 FROM totals)
        ELSE 0 END,
    'repeatRevenuePct',
      CASE WHEN (SELECT total_revenue FROM totals) > 0
        THEN (SELECT repeat_revenue::numeric / total_revenue * 100 FROM totals)
        ELSE 0 END,
    'topCustomers',
      (SELECT COALESCE(json_agg(top5), '[]'::json) FROM top5),
    'newCustomerCount',
      CASE WHEN p_from IS NOT NULL THEN
        (SELECT COUNT(DISTINCT ir.customer_id)
         FROM in_range ir
         WHERE NOT EXISTS (SELECT 1 FROM prior_ids p WHERE p.customer_id = ir.customer_id))
      ELSE 0 END
  );
$$;

GRANT EXECUTE ON FUNCTION get_customer_stats(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- get_rfm_data
-- Pre-aggregates orders by customer for useCustomerRFM.
-- Returns M rows (one per customer) instead of N order rows.
-- Classification (champion/loyal/at_risk/new/lost) stays client-side
-- since it needs the 75th-percentile spend threshold across the result set.
-- ============================================================
CREATE OR REPLACE FUNCTION get_rfm_data(
  p_workspace_id uuid,
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL
)
RETURNS TABLE(customer_id text, last_order_at timestamptz, order_count bigint, total_spend numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    customer_id,
    MAX(created_at)   AS last_order_at,
    COUNT(*)          AS order_count,
    SUM(revenue)      AS total_spend
  FROM orders
  WHERE workspace_id = p_workspace_id
    AND customer_id IS NOT NULL
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to   IS NULL OR created_at <= p_to)
  GROUP BY customer_id;
$$;

GRANT EXECUTE ON FUNCTION get_rfm_data(uuid, timestamptz, timestamptz) TO authenticated;
