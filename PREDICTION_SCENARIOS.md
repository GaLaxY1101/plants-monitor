# Prediction System Scenarios

This document describes all possible scenarios in the plant monitoring prediction system and what messages/statuses are displayed for each parameter type.

## Sensor Types
- **Temperature** (°C)
- **Ground Moisture** (%)
- **Air Moisture** (%)

---

## Scenario Overview

### Status Types
- `immediate` - Action required NOW (red alert)
- `scheduled` - Action scheduled for future (orange alert)
- `no_data` - Insufficient data for predictions
- `no_trend` - No significant trend detected
- `no_reach` - Trend detected but won't reach threshold
- `will_not_reach` - Value won't reach threshold (not currently used)

---

## Scenario 1: Insufficient Data

**Condition**: Less than minimal sensor readings from last 3 days

**Status**: `no_data`  
**Action**: `none`  
**Action In Hours**: `0`

**Message**:
```
Insufficient data for analysis of [Sensor Name]. Need at least some sensor readings from the last 3 days.
```

**UI Display**: No recommendation shown

---

## Scenario 2: No Trend (Stable Value)

### 2a. No Trend - Out of Range

**Condition**: 
- `hourChange ≈ 0` (no significant change)
- `currentValue` is OUT of ideal range

**Status**: `immediate`  
**Action**: Based on sensor type and value position
- Temperature below min → `heating`
- Temperature above max → `cooling`
- Ground Moisture below min → `watering`
- Ground Moisture above max → `reduceWatering`
- Air Moisture below min → `watering`
- Air Moisture above max → `cooling`

**Action In Hours**: `0`

**Message**:
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
No trend detected (stable), but value is out of range — immediate intervention required.
```

**UI Display**: 
- **Temperature**: "Increase temperature NOW" or "Cool NOW"
- **Ground Moisture**: "Water the plant NOW" or "Reduce watering NOW"
- **Air Moisture**: "Water air NOW" or "Cool NOW"

### 2b. No Trend - Within Range

**Condition**: 
- `hourChange ≈ 0` (no significant change)
- `currentValue` is WITHIN ideal range

**Status**: `no_trend`  
**Action**: `none`  
**Action In Hours**: `0`

**Message**:
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
No trend detected (stable) — no predicted changes.
```

**UI Display**: No action alert, just "Monitor" status chip

---

## Scenario 3: Within Range - Trend Will Take It Out (PREVENTIVE)

### 3a. Within Range - Trending DOWN (Will Go Below Min)

**Condition**: 
- `currentValue` is WITHIN ideal range
- `hourChange < 0` (trending down)
- `currentValue + hourChange * 24 < idealMin` (will go below min in 24h)

**Status**: `scheduled`  
**Action**: 
- Temperature → `heating`
- Ground Moisture → `watering`
- Air Moisture → `watering`

**Action In Hours**: `hoursToThreshold - PREVENT_MARGIN_HOURS` (typically ~1 hour before threshold)

**Message**:
```
[Sensor Name]:
Recent values (3 days ago, 2 days ago, today avg): [X.XX], [Y.YY], [Z.ZZ]
Current reading: [CURRENT]
Ideal range: [MIN] - [MAX]
Average daily change: [CHANGE]
Average hourly rate: [RATE]

Expected to reach minimum ([MIN]) in [HOURS] hours.
RECOMMENDATION: Schedule '[action]' action in [ACTION_HOURS] hours.
```

**UI Display**:
- **Temperature**: "Increase temperature in Xh Ym" (orange alert)
- **Ground Moisture**: "Water the plant in Xh Ym" (orange alert)
- **Air Moisture**: "Water air in Xh Ym" (orange alert)

### 3b. Within Range - Trending UP (Will Go Above Max)

**Condition**: 
- `currentValue` is WITHIN ideal range
- `hourChange > 0` (trending up)
- `currentValue + hourChange * 24 > idealMax` (will go above max in 24h)

**Status**: `scheduled`  
**Action**: 
- Temperature → `cooling`
- Ground Moisture → `reduceWatering`
- Air Moisture → `cooling`

**Action In Hours**: `hoursToThreshold - PREVENT_MARGIN_HOURS` (typically ~1 hour before threshold)

**Message**:
```
[Sensor Name]:
Recent values (3 days ago, 2 days ago, today avg): [X.XX], [Y.YY], [Z.ZZ]
Current reading: [CURRENT]
Ideal range: [MIN] - [MAX]
Average daily change: [CHANGE]
Average hourly rate: [RATE]

Expected to reach maximum ([MAX]) in [HOURS] hours.
RECOMMENDATION: Schedule '[action]' action in [ACTION_HOURS] hours.
```

**UI Display**:
- **Temperature**: "Cool in Xh Ym" (orange alert)
- **Ground Moisture**: "Reduce watering in Xh Ym" (orange alert)
- **Air Moisture**: "Cool in Xh Ym" (orange alert)

### 3c. Within Range - Trend Maintains Range

**Condition**: 
- `currentValue` is WITHIN ideal range
- Trend is NOT taking it out of range

**Status**: `no_trend`  
**Action**: `none`  
**Action In Hours**: `0`

**Message**:
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
Trend is maintaining ideal range — no action required.
```

**UI Display**: No action alert, just "Monitor" status chip

---

## Scenario 4: Out of Range (CORRECTIVE)

### 4a. Below Minimum - Immediate Action Required

**Condition**: 
- `currentValue < idealMin` (below minimum)

**Status**: `immediate` (ALWAYS, regardless of trend)  
**Action**: 
- Temperature → `heating`
- Ground Moisture → `watering`
- Air Moisture → `watering`

**Action In Hours**: `0`

**Message** (if trend improving):
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
Value is below ideal range. Trend is improving, but immediate action is still required to bring value into range faster.
Action '[action]' required immediately.
```

**Message** (if trend worsening):
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
Value is below ideal range. Trend is moving away from ideal range.
Action '[action]' required immediately.
```

**UI Display**:
- **Temperature**: "Increase temperature NOW" (red alert)
- **Ground Moisture**: "Water the plant NOW" (red alert)
- **Air Moisture**: "Water air NOW" (red alert)

### 4b. Above Maximum - Immediate Action Required

**Condition**: 
- `currentValue > idealMax` (above maximum)

**Status**: `immediate` (ALWAYS, regardless of trend)  
**Action**: 
- Temperature → `cooling`
- Ground Moisture → `reduceWatering`
- Air Moisture → `cooling`

**Action In Hours**: `0`

**Message** (if trend improving):
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
Value is above ideal range. Trend is improving, but immediate action is still required to bring value into range faster.
Action '[action]' required immediately.
```

**Message** (if trend worsening):
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
Value is above ideal range. Trend is moving away from ideal range.
Action '[action]' required immediately.
```

**UI Display**:
- **Temperature**: "Cool NOW" (red alert)
- **Ground Moisture**: "Reduce watering NOW" (red alert)
- **Air Moisture**: "Cool NOW" (red alert)

---

## Scenario 5: No Threshold Reach

**Condition**: 
- `currentValue` is WITHIN ideal range
- Trend detected but won't reach threshold

**Status**: `no_reach`  
**Action**: `none`  
**Action In Hours**: `0`

**Message**:
```
[Sensor Name]: Current value is [X.XX], ideal range is [MIN] - [MAX].
Trend: [RATE] per hour. No predicted threshold reach.
```

**UI Display**: No action alert, just "Monitor" status chip

---

## Action Labels by Sensor Type

### Temperature
- `heating` → "Increase temperature"
- `cooling` → "Cool"

### Ground Moisture
- `watering` → "Water the plant"
- `reduceWatering` → "Reduce watering"

### Air Moisture
- `watering` → "Water air"
- `cooling` → "Cool"

---

## Summary Table

| Scenario | Current Value | Trend | Status | Action Timing |
|----------|--------------|-------|--------|---------------|
| Insufficient data | Any | N/A | `no_data` | None |
| No trend, out of range | Out | Stable | `immediate` | NOW |
| No trend, in range | In | Stable | `no_trend` | None |
| In range, trending out (down) | In | Down | `scheduled` | Future (~1h before threshold) |
| In range, trending out (up) | In | Up | `scheduled` | Future (~1h before threshold) |
| In range, trend maintains | In | Any | `no_trend` | None |
| Out of range (below min) | Below | Any | `immediate` | NOW |
| Out of range (above max) | Above | Any | `immediate` | NOW |
| No threshold reach | In | Any | `no_reach` | None |

---

## Key Rules

1. **Out of Range = Immediate Action**: If a parameter is out of range, action is ALWAYS immediate, regardless of trend direction.

2. **Preventive Scheduling**: Scheduled actions only occur when value is WITHIN range but trending out (preventive maintenance).

3. **Margin Hours**: 
   - `PREVENT_MARGIN_HOURS = 1.0` hour before threshold for preventive actions
   - `OVERSHOOT_MARGIN_HOURS = 1.0` hour after threshold (for overshoot scenarios)

4. **Data Quality**: System handles missing data through interpolation/extrapolation and warns if data quality is partial.

