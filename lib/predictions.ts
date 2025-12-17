const PREVENT_MARGIN_HOURS = 12.0;
const OVERSHOOT_MARGIN_HOURS = 1.0;

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

function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
function getActionType(
  sensorType: 'groundMoisture' | 'temperature' | 'airMoisture',
  currentValue: number,
  min: number,
  max: number
): 'watering' | 'heating' | 'cooling' | 'reduceWatering' | 'none' {
  if (isWithinRange(currentValue, min, max)) {
    return 'none';
  }

  if (sensorType === 'groundMoisture') {
    if (currentValue < min) {
      return 'watering';
    } else if (currentValue > max) {
      return 'reduceWatering';
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
    return 'none';
  }

  return 'none';
}

function getTargetThreshold(
  currentValue: number,
  min: number,
  max: number,
  hourChange: number
): { threshold: number; type: 'min' | 'max' | 'none' } {
  if (isWithinRange(currentValue, min, max)) {
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

function aggregateToDailyAverages(
  dataPoints: SensorDataPoint[],
  daysBack: number = 3
): { values: number[]; dataQuality: 'good' | 'partial' | 'insufficient' } {
  if (dataPoints.length === 0) {
    return { values: [], dataQuality: 'insufficient' };
  }

  const now = new Date();
  const dailyAverages: { [key: string]: { sum: number; count: number } } = {};

  for (let i = 0; i < daysBack; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    dailyAverages[dayKey] = { sum: 0, count: 0 };
  }

  for (const point of dataPoints) {
    const dayKey = point.timestamp.toISOString().split('T')[0];
    if (dailyAverages[dayKey]) {
      dailyAverages[dayKey].sum += point.value;
      dailyAverages[dayKey].count += 1;
    }
  }

  const result: number[] = [];
  const daysWithData: number[] = [];
  
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayKey = date.toISOString().split('T')[0];
    const dayData = dailyAverages[dayKey];
    
    if (dayData.count > 0) {
      const avg = dayData.sum / dayData.count;
      result.push(avg);
      daysWithData.push(i);
    } else {
      let estimatedValue: number | null = null;
      let beforeValue: number | null = null;
      let afterValue: number | null = null;
      
      for (let j = i + 1; j < daysBack; j++) {
        const beforeDate = new Date(now);
        beforeDate.setDate(beforeDate.getDate() - j);
        const beforeKey = beforeDate.toISOString().split('T')[0];
        if (dailyAverages[beforeKey] && dailyAverages[beforeKey].count > 0) {
          beforeValue = dailyAverages[beforeKey].sum / dailyAverages[beforeKey].count;
          break;
        }
      }
      
      for (let j = i - 1; j >= 0; j--) {
        const afterDate = new Date(now);
        afterDate.setDate(afterDate.getDate() - j);
        const afterKey = afterDate.toISOString().split('T')[0];
        if (dailyAverages[afterKey] && dailyAverages[afterKey].count > 0) {
          afterValue = dailyAverages[afterKey].sum / dailyAverages[afterKey].count;
          break;
        }
      }
      
      if (beforeValue !== null && afterValue !== null) {
        estimatedValue = (beforeValue + afterValue) / 2;
      } else if (beforeValue !== null) {
        estimatedValue = beforeValue;
      } else if (afterValue !== null) {
        estimatedValue = afterValue;
      } else if (result.length > 0) {
        estimatedValue = result[result.length - 1];
      } else {
        estimatedValue = dataPoints.reduce((sum, p) => sum + p.value, 0) / dataPoints.length;
      }
      
      result.push(estimatedValue);
    }
  }

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

export function computeForecastAndAction(
  dataPoints: SensorDataPoint[],
  idealMin: number,
  idealMax: number,
  sensorType: 'groundMoisture' | 'temperature' | 'airMoisture',
  sensorName: string
): { readableText: string; info: PredictionInfo } {
  const now = new Date();
  
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
  }

  const [dayBeforeYesterday, yesterday, todayAvg] = dailyValues;
  
  const sortedDataPoints = [...dataPoints].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );
  const mostRecentReading = sortedDataPoints.length > 0 
    ? sortedDataPoints[0].value 
    : todayAvg;
  const currentValue = mostRecentReading;
  
  const diff1 = yesterday - dayBeforeYesterday;
  const diff2 = todayAvg - yesterday;
  const avgDayChange = (diff1 + diff2) / 2.0;
  const hourChange = avgDayChange / 24.0;

  let { threshold, type: thresholdType } = getTargetThreshold(
    currentValue,
    idealMin,
    idealMax,
    hourChange
  );
  
  let action: 'watering' | 'heating' | 'cooling' | 'reduceWatering' | 'none';
  if (thresholdType === 'min') {
    if (sensorType === 'groundMoisture') {
      action = 'watering';
    } else if (sensorType === 'temperature') {
      action = 'heating';
    } else if (sensorType === 'airMoisture') {
      action = 'watering';
    } else {
      action = 'none';
    }
  } else if (thresholdType === 'max') {
    if (sensorType === 'groundMoisture') {
      action = 'reduceWatering';
    } else if (sensorType === 'temperature') {
      action = 'cooling';
    } else if (sensorType === 'airMoisture') {
      action = 'cooling';
    } else {
      action = 'none';
    }
  } else {
    action = getActionType(sensorType, currentValue, idealMin, idealMax);
  }
  
  let delta: number;
  if (thresholdType === 'min') {
    delta = idealMin - currentValue;
  } else if (thresholdType === 'max') {
    delta = currentValue - idealMax;
  } else {
    delta = 0;
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

  if (isWithinRange(currentValue, idealMin, idealMax)) {
    if (hourChange < 0 && currentValue + hourChange * 24 < idealMin) {
      willReach = true;
      threshold = idealMin;
      thresholdType = 'min';
      delta = idealMin - currentValue;
      if (sensorType === 'groundMoisture') {
        action = 'watering';
      } else if (sensorType === 'temperature') {
        action = 'heating';
      } else if (sensorType === 'airMoisture') {
        action = 'watering';
      }
    } else if (hourChange > 0 && currentValue + hourChange * 24 > idealMax) {
      willReach = true;
      threshold = idealMax;
      thresholdType = 'max';
      delta = currentValue - idealMax;
      if (sensorType === 'groundMoisture') {
        action = 'reduceWatering';
      } else if (sensorType === 'temperature') {
        action = 'cooling';
      } else if (sensorType === 'airMoisture') {
        action = 'cooling';
      }
    } else {
      const text = `${sensorName}: Current value is ${currentValue.toFixed(2)}, ideal range is ${idealMin.toFixed(2)} - ${idealMax.toFixed(2)}.\n` +
        'Trend is maintaining ideal range — no action required.';
      info.status = 'no_trend';
      info.action = 'none';
      info.readableText = text;
      return { readableText: text, info };
    }
  }
  else {
    if (thresholdType === 'min') {
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

  if (willReach && thresholdType !== 'none') {
    if (thresholdType === 'max' && hourChange < 0) {
      marginHours = -OVERSHOOT_MARGIN_HOURS;
    } else if (thresholdType === 'min' && hourChange > 0) {
      marginHours = -OVERSHOOT_MARGIN_HOURS;
    } else {
      marginHours = PREVENT_MARGIN_HOURS;
    }
  }

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

  const readable: string[] = [];
  readable.push(`${sensorName}:`);
  
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
