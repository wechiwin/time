SELECT h.ho_code,
       h.ho_short_name,
       has.snapshot_date,
       has.window_key,
       has.has_cumulative_pnl,
       has.has_position_ratio,
       has.has_portfolio_contribution
FROM holding h
         LEFT JOIN holding_analytics_snapshot has
                   ON has.user_id = h.user_id
                       AND has.ho_id = h.id
WHERE h.ho_status = 'HOLDING'
  AND has.snapshot_date = :snapshot_date
  AND has.window_key = :window_key
ORDER BY has.has_position_ratio DESC;
