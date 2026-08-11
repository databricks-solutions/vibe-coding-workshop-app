-- =============================================================================
-- SAY AT WHICH GRAIN THE INCIDENT MUST BE VISIBLE
-- =============================================================================
-- Found by executing the step-59 brief for real on serverless -- the first time the
-- corrected brief has been run end to end -- and then charting the result, which is the
-- one check no automated test can make.
--
-- What happened. The generated data was correct in every respect the brief asks for: the
-- peak landed on SPIKE_PEAK (three weeks back, not at max(date)), there was a clean
-- buildup and decay, no orphan foreign keys, non-uniform distributions, 15,000 rows. At
-- the affected-property grain the incident was unmistakable -- 22.4% failure against a
-- ~2% baseline.
--
-- And the top-line weekly chart showed 3.9% against a 1.7% baseline. Invisible. Because
-- two properties out of forty were affected, aggregating across all properties diluted a
-- 10x signal into noise.
--
-- So the brief's "the incident must dominate ordinary variation" was followed and still
-- produced a chart nobody can read, because it never said DOMINATE WHERE. An agent
-- reasonably reads it as a property of the data and satisfies it at the grain it happens
-- to be generating at; the attendee then opens a dashboard that leads with a total.
--
-- This adds the missing half: name the view the incident must be visible in, and make the
-- agent verify it there rather than assert it. Two ways to satisfy it -- concentrate the
-- incident, or make the dashboard's leading view the segmented one -- and both are
-- legitimate, so the brief says so rather than dictating.
--
-- Idempotency: guarded on the old contrast text still being present, so it applies at
-- most once and a facilitator's rewording survives.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET input_template = replace(
      input_template,
      'Contrast:        the incident must dominate ordinary variation. If a reader cannot
                 point at it on a chart without squinting, either raise the event or
                 lower the baseline noise — and tell me which you did and why.
                 Realistic noise plus a subtle event is the failure mode here: it
                 looks like real data and demonstrates nothing.',
      'Contrast:        the incident must dominate ordinary variation — and tell me AT
                 WHICH GRAIN it does. This is the part that goes wrong: if the
                 incident affects two entities out of forty, a chart totalled
                 across all forty dilutes a 10x signal into noise, and every
                 individual rule above is still satisfied. I hit exactly that on a
                 real run: 22% failure at the affected grain, 3.9% on the
                 top-line weekly chart, indistinguishable from baseline.
                 So: after generating, actually run the aggregation a dashboard
                 would lead with, print it, and tell me whether the incident is
                 visible there. If it is not, fix it one of two ways and say which:
                   (a) concentrate the incident so it moves the total — fewer
                       affected entities but a larger effect, or a segment big
                       enough to shift the aggregate; or
                   (b) keep it concentrated and tell me the leading view has to be
                       segmented (by property, carrier, region — whatever your
                       entity is) rather than a total.
                 Both are legitimate. What is not legitimate is asserting the
                 contrast without having looked at the chart.
                 Realistic noise plus a subtle event is the failure mode here: it
                 looks like real data and demonstrates nothing.'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_provision'
  AND is_active = TRUE
  AND position('the incident must dominate ordinary variation. If a reader cannot' in input_template) > 0;

-- -----------------------------------------------------------------------------
-- Step 16 — the 5-second test needs the same qualifier
-- -----------------------------------------------------------------------------
-- Same root cause on the dashboard side: "does the baseline make the anomaly relatively
-- large" is answerable yes at one grain and no at another, and the attendee will be
-- looking at whichever view the agent happened to put on page 1.
UPDATE ${schema}.section_input_prompts
SET expected_output = replace(
      expected_output,
      '- Does the baseline make the anomaly *relatively* large, or is it flattened by the
  y-axis scale?',
      '- Does the baseline make the anomaly *relatively* large, or is it flattened by the
  y-axis scale?
- **Is the leading view at the right grain?** An incident affecting two properties out of
  forty disappears in a chart totalled across all forty — the data is fine and the chart
  is useless. If your headline view is a total, either segment it or lead with the
  worst-offenders table instead.'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'aibi_dashboard'
  AND is_active = TRUE
  AND position('Is the leading view at the right grain?' in coalesce(expected_output, '')) = 0
  AND position('flattened by the' in coalesce(expected_output, '')) > 0;
