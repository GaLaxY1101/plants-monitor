// Prediction service for plant monitoring
// Based on analyzing sensor data trends from the last 3 days

const PREVENT_MARGIN_HOURS = 1.0; // Hours before threshold to take action
const OVERSHOOT_MARGIN_HOURS = 1.0; // Hours after threshold to continue action

export interface PredictionInfo {
  status: 'immediate' | 'scheduled' | 'no_data' | 'no_trend' | 'no_reach' | 'will_not_reach';
  action: 'watering' | 'heating' | 'cooling' | 'reduceWatering' | 'none';
  actionInHours: number;
  actionTime?: Date;
  hoursToThreshold?: number;
  currentValue: number;
  idealRange: {
    min: number;
    max: number;
  };
  trend: {
    avgDayChange: number;
    hourChange: number;
    values: number[]; // [dayBeforeYesterday, yesterday, today]
  };
  readableText: string;
}

export interface SensorDataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Check if value is within ideal range
 */
function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Get action type based on sensor type and current value vs ideal range
 */
function getActionType(
  sensorType: 'groundMoisture' | 'temperature' | 'airMoisture',
  currentValue: number,
  min: number,
  max: number
): 'watering' | 'heating' | 'cooling' | 'reduceWatering' | 'none' {
  if (isWithinRange(currentValue, min, max)) {
    return 'none'; // Value is within ideal range
  }

  if (sensorType === 'groundMoisture') {
    if (currentValue < min) {
      return 'watering';
    } else if (currentValue > max) {
      return 'reduceWatering'; // Too much moisture - reduce watering
    }
    return 'none';
  }
  
  if (sensorType === 'temperature') {
    if (currentValue < min) {
      return 'heating';
    } else if (currentValue > max) {
      return 'cooling';
    }
  }

  if (sensorType === 'airMoisture') {
    // Air moisture typically doesn't require active intervention, but could be noted
    return 'none';
  }

  return 'none';
}

/**
 * Determine which threshold (min or max) we need to reach
 */
function getTargetThreshold(
  currentValue: number,
  min: number,
  max: number,
  hourChange: number
): { threshold: number; type: 'min' | 'max' | 'none' } {
  if (isWithinRange(currentValue, min, max)) {
    // If within range, check if trend will take us out
    if (hourChange < 0 && currentValue - Math.abs(hourChange) * 24 < min) {
      return { threshold: min, type: 'min' };
    }
    if (hourChange > 0 && currentValue + hourChange * 24 > max) {
      return { threshold: max, type: 'max' };
    }
    return { threshold: 0, type: 'none' };
  }

  if (currentValue < min) {
    return { threshold: min, type: 'min' };
  }

  if (currentValue > max) {
    return { threshold: max, type: 'max' };
  }

  return { threshold: 0, type: 'none' };
}

/**
 * Aggregate sensor data points into daily averages
 * Returns array of daily averages for the last 3 days
 * Handles missing data by using interpolation and extrapolation
 */
function aggregateToDailyAverages(
  dataPoints: SensorDataPoint[],
  daysBack: number = 3
): { values: number[]; dataQuality: 'good' | 'partial' | 'insufficient' } {
  if (dataPoints.length === 0) {
    return { values: [], dataQuality: 'insufficient' };
  }

  const now = new Date();
  const dailyAverages: { [key: string]: { sum: number; count: number } } = {};

  // Initialize days
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    dailyAverages[dayKey] = { sum: 0, count: 0 };
  }

  // Aggregate data points by day
  for (const point of dataPoints) {
    const dayKey = point.timestamp.toISOString().split('T')[0];
    if (dailyAverages[dayKey]) {
      dailyAverages[dayKey].sum += point.value;
      dailyAverages[dayKey].count += 1;
    }
  }

  // Calculate averages and return in chronological order (oldest first)
  const result: number[] = [];
  const daysWithData: number[] = [];
  
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayKey = date.toISOString().split('T')[0];
    const dayData = dailyAverages[dayKey];
    
    if (dayData.count > 0) {
      // We have data for this day
      const avg = dayData.sum / dayData.count;
      result.push(avg);
      daysWithData.push(i);
    } else {
      // No data for this day - need to estimate
      let estimatedValue: number | null = null;
      
      // Try interpolation: if we have data before and after, interpolate
      let beforeValue: number | null = null;
      let afterValue: number | null = null;
      
      // Look for data before this day
      for (let j = i + 1; j < daysBack; j++) {
        const beforeDate = new Date(now);
        beforeDate.setDate(beforeDate.getDate() - j);
        const beforeKey = beforeDate.toISOString().split('T')[0];
        if (dailyAverages[beforeKey] && dailyAverages[beforeKey].count > 0) {
          beforeValue = dailyAverages[beforeKey].sum / dailyAverages[beforeKey].count;
          break;
        }
      }
      
      // Look for data after this day
      for (let j = i - 1; j >= 0; j--) {
        const afterDate = new Date(now);
        afterDate.setDate(afterDate.getDate() - j);
        const afterKey = afterDate.toISOString().split('T')[0];
        if (dailyAverages[afterKey] && dailyAverages[afterKey].count > 0) {
          afterValue = dailyAverages[afterKey].sum / dailyAverages[afterKey].count;
          break;
        }
      }
      
      // Interpolate if we have both before and after
      if (beforeValue !== null && afterValue !== null) {
        estimatedValue = (beforeValue + afterValue) / 2;
      } else if (beforeValue !== null) {
        // Extrapolate backward: use the previous value
        estimatedValue = beforeValue;
      } else if (afterValue !== null) {
        // Extrapolate forward: use the next value
        estimatedValue = afterValue;
      } else if (result.length > 0) {
        // Use the last calculated value (most recent)
        estimatedValue = result[result.length - 1];
      } else {
        // Use overall average as last resort
        estimatedValue = dataPoints.reduce((sum, p) => sum + p.value, 0) / dataPoints.length;
      }
      
      result.push(estimatedValue);
    }
  }

  // Determine data quality
  let dataQuality: 'good' | 'partial' | 'insufficient';
  if (daysWithData.length >= 3) {
    dataQuality = 'good';
  } else if (daysWithData.length >= 2 || (daysWithData.length >= 1 && dataPoints.length >= 5)) {
    dataQuality = 'partial';
  } else {
    dataQuality = 'insufficient';
  }

  return { values: result, dataQuality };
}

/**
 * Compute forecast and action recommendation based on sensor data trends
 */
export function computeForecastAndAction(
  dataPoints: SensorDataPoint[],
  idealMin: number,
  idealMax: number,
  sensorType: 'groundMoisture' | 'temperature' | 'airMoisture',
  sensorName: string
): { readableText: string; info: PredictionInfo } {
  const now = new Date();
  
  // Aggregate to daily averages
  const { values: dailyValues, dataQuality } = aggregateToDailyAverages(dataPoints, 3);
  
  if (dataQuality === 'insufficient') {
    const text = `Insufficient data for analysis of ${sensorName}. Need at least some sensor readings from the last 3 days.`;
    return {
      readableText: text,
      info: {
        status: 'no_data',
        action: 'none',
        actionInHours: 0,
        currentValue: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : 0,
        idealRange: {
          min: idealMin,
          max: idealMax,
        },
        trend: {
          avgDayChange: 0,
          hourChange: 0,
          values: [],
        },
        readableText: text,
      },
    };
  }

  if (dailyValues.length < 3) {
    const text = `Limited data available for ${sensorName}. Predictions may be less accurate.`;
    // Still try to make predictions with available data
  }

  const [dayBeforeYesterday, yesterday, todayAvg] = dailyValues;
  
  // Get the most recent reading as the current value (not daily average)
  // Sort dataPoints by timestamp to get the most recent
  const sortedDataPoints = [...dataPoints].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );
  const mostRecentReading = sortedDataPoints.length > 0 
    ? sortedDataPoints[0].value 
    : todayAvg;
  const currentValue = mostRecentReading;
  
  // Calculate trends using daily averages for trend analysis
  const diff1 = yesterday - dayBeforeYesterday;
  const diff2 = todayAvg - yesterday;
  const avgDayChange = (diff1 + diff2) / 2.0;
  const hourChange = avgDayChange / 24.0;

  // Determine which threshold we're targeting (min or max) based on current value and trend
  let { threshold, type: thresholdType } = getTargetThreshold(
    currentValue,
    idealMin,
    idealMax,
    hourChange
  );
  
  // Determine action based on threshold being approached (not just current value)
  // This is important for Case 2 where we're within range but trending out
  let action: 'watering' | 'heating' | 'cooling' | 'reduceWatering' | 'none';
  if (thresholdType === 'min') {
    // Approaching minimum threshold - need to increase value
    if (sensorType === 'groundMoisture') {
      action = 'watering';
    } else if (sensorType === 'temperature') {
      action = 'heating';
    } else if (sensorType === 'airMoisture') {
      action = 'watering'; // Increase humidity
    } else {
      action = 'none';
    }
  } else if (thresholdType === 'max') {
    // Approaching maximum threshold - need to decrease value
    if (sensorType === 'groundMoisture') {
      action = 'reduceWatering';
    } else if (sensorType === 'temperature') {
      action = 'cooling';
    } else if (sensorType === 'airMoisture') {
      action = 'cooling'; // Decrease humidity (ventilation)
    } else {
      action = 'none';
    }
  } else {
    // No threshold being approached - use current value to determine action
    action = getActionType(sensorType, currentValue, idealMin, idealMax);
  }
  
  // Calculate delta based on threshold
  let delta: number;
  if (thresholdType === 'min') {
    delta = idealMin - currentValue; // Positive if below min
  } else if (thresholdType === 'max') {
    delta = currentValue - idealMax; // Positive if above max
  } else {
    delta = 0; // Within range
  }

  const info: PredictionInfo = {
    status: 'no_trend',
    action: 'none',
    actionInHours: 0,
    currentValue: currentValue,
    idealRange: {
      min: idealMin,
      max: idealMax,
    },
    trend: {
      avgDayChange,
      hourChange,
      values: dailyValues,
    },
    readableText: '',
  };

  // Case 1: No change (hourChange == 0)
  if (Math.abs(hourChange) < 1e-9) {
    if (!isWithinRange(currentValue, idealMin, idealMax) && action !== 'none') {
      const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
        'No trend detected (stable), but value is out of range — immediate intervention required.';
      info.status = 'immediate';
      info.action = action;
      info.actionInHours = 0;
      info.actionTime = now;
      info.readableText = text;
      return { readableText: text, info };
    } else {
      const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
        'No trend detected (stable) — no predicted changes.';
      info.status = 'no_trend';
      info.action = 'none';
      info.readableText = text;
      return { readableText: text, info };
    }
  }

  let marginHours = PREVENT_MARGIN_HOURS;
  let willReach = false;

  // Case 2: Current value is within range, but trend might take it out
  if (isWithinRange(currentValue, idealMin, idealMax)) {
    // Check if trend will take us out of range
    if (hourChange < 0 && currentValue + hourChange * 24 < idealMin) {
      // Moving down, will go below min
      willReach = true;
      threshold = idealMin;
      thresholdType = 'min';
      delta = idealMin - currentValue;
      // Update action based on threshold being approached
      if (sensorType === 'groundMoisture') {
        action = 'watering';
      } else if (sensorType === 'temperature') {
        action = 'heating';
      } else if (sensorType === 'airMoisture') {
        action = 'watering'; // Increase humidity
      }
    } else if (hourChange > 0 && currentValue + hourChange * 24 > idealMax) {
      // Moving up, will go above max
      willReach = true;
      threshold = idealMax;
      thresholdType = 'max';
      delta = currentValue - idealMax;
      // Update action based on threshold being approached
      if (sensorType === 'groundMoisture') {
        action = 'reduceWatering';
      } else if (sensorType === 'temperature') {
        action = 'cooling';
      } else if (sensorType === 'airMoisture') {
        action = 'cooling'; // Decrease humidity (ventilation)
      }
    } else {
      // Staying within range
      const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
        'Trend is maintaining ideal range — no action required.';
      info.status = 'no_trend';
      info.action = 'none';
      info.readableText = text;
      return { readableText: text, info };
    }
  }
  // Case 3: Current value is OUT of range
  else {
    // If value is out of range, ALWAYS recommend immediate action
    // Scheduled actions are only for preventive maintenance (within range, trending out)
    
    if (thresholdType === 'min') {
      // Below minimum - immediate action needed
      const actionName = action === 'watering' ? 'watering' : 
                        action === 'heating' ? 'heating' : 
                        action === 'cooling' ? 'cooling' :
                        action === 'reduceWatering' ? 'reduce watering' : 'action';
      const trendNote = hourChange > 0 
        ? 'Trend is improving, but immediate action is still required to bring value into range faster.'
        : 'Trend is moving away from ideal range.';
      const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
        `Value is below ideal range. ${trendNote}\n` +
        `Action '${actionName}' required immediately.`;
      info.status = 'immediate';
      info.action = action;
      info.actionInHours = 0;
      info.actionTime = now;
      info.readableText = text;
      return { readableText: text, info };
    } else if (thresholdType === 'max') {
      // Above maximum - immediate action needed
      const actionName = action === 'cooling' ? 'cooling' : 
                        action === 'reduceWatering' ? 'reduce watering' : 'action';
      const trendNote = hourChange < 0 
        ? 'Trend is improving, but immediate action is still required to bring value into range faster.'
        : 'Trend is moving away from ideal range.';
      const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
        `Value is above ideal range. ${trendNote}\n` +
        `Action '${actionName}' required immediately.`;
      info.status = 'immediate';
      info.action = action;
      info.actionInHours = 0;
      info.actionTime = now;
      info.readableText = text;
      return { readableText: text, info };
    }
  }

  // Case 4: Will reach threshold
  if (willReach && thresholdType !== 'none') {
    // OVERSHOOT scenarios - we're moving towards threshold
    if (thresholdType === 'max' && hourChange < 0) {
      // Moving down towards max from above
      marginHours = -OVERSHOOT_MARGIN_HOURS;
    } else if (thresholdType === 'min' && hourChange > 0) {
      // Moving up towards min from below
      marginHours = -OVERSHOOT_MARGIN_HOURS;
    } else {
      // PREVENT scenario
      marginHours = PREVENT_MARGIN_HOURS;
    }
  }

  // Calculate time to threshold
  if (!willReach) {
    const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
      `Trend: ${hourChange.toFixed(4)} per hour. No predicted threshold reach.`;
    info.status = 'no_reach';
    info.action = 'none';
    info.readableText = text;
    return { readableText: text, info };
  }

  let hoursLeft: number;
  if (Math.abs(delta) > 1e-9 && Math.abs(hourChange) > 1e-9) {
    hoursLeft = Math.abs(delta / hourChange);
  } else {
    hoursLeft = 0;
  }

  const actionInHours = Math.max(0, hoursLeft - marginHours);

  // Determine status
  if (actionInHours <= 0) {
    info.status = 'immediate';
    info.actionTime = now;
  } else {
    info.status = 'scheduled';
    info.actionTime = new Date(now.getTime() + actionInHours * 60 * 60 * 1000);
  }

  info.hoursToThreshold = hoursLeft;
  info.action = action;
  info.actionInHours = actionInHours;

  // Build readable text
  const readable: string[] = [];
  readable.push(`${sensorName}:`);
  
  // Add data quality warning if needed
  if (dataQuality === 'partial') {
    readable.push('⚠️ Note: Limited historical data available. Some values were estimated.');
  }
  
  readable.push(`Recent values (3 days ago, 2 days ago, today avg): ${dayBeforeYesterday.toFixed(2)}, ${yesterday.toFixed(2)}, ${todayAvg.toFixed(2)}`);
  readable.push(`Current reading: ${currentValue.toFixed(2)}`);
  readable.push(`Ideal range: ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}`);
  readable.push(`Average daily change: ${avgDayChange.toFixed(3)}`);
  readable.push(`Average hourly rate: ${hourChange.toFixed(4)}`);
  readable.push('');

  if (hoursLeft > 1e-9 && thresholdType !== 'none') {
    const thresholdLabel = thresholdType === 'min' ? `minimum (${idealMin.toFixed(2)})` : `maximum (${idealMax.toFixed(2)})`;
    readable.push(`Expected to reach ${thresholdLabel} in ${hoursLeft.toFixed(2)} hours.`);
  }

  const actionName = action === 'watering' ? 'watering' : 
                    action === 'heating' ? 'heating' : 
                    action === 'cooling' ? 'cooling' :
                    action === 'reduceWatering' ? 'reduce watering' : 'action';
  if (info.status === 'immediate') {
    readable.push(`RECOMMENDATION: Perform '${actionName}' action NOW.`);
  } else if (info.status === 'scheduled') {
    readable.push(`RECOMMENDATION: Schedule '${actionName}' action in ${actionInHours.toFixed(2)} hours.`);
  } else {
    readable.push('Current value is in ideal range, trend is favorable/stable.');
  }

  const readableText = readable.join('\n');
  info.readableText = readableText;

  return { readableText, info };
}
