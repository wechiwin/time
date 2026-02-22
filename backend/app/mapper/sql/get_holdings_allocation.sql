SELECT h.ho_code,
       h.ho_short_name,
       has.snapshot_date,
       has.window_key,
       has.has_cumulative_pnl,
       has.has_position_ratio,
       has.has_portfolio_contribution
FROM holding h
         INNER JOIN holding_analytics_snapshot has
                    ON has.ho_id = h.id
                        AND has.user_id = :user_id
WHERE has.snapshot_date = :snapshot_date
  AND has.window_key = :window_key
ORDER BY has.has_position_ratio DESC;
