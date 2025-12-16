// Script to populate sensors with logs for the previous day
// Usage: node scripts/populate-logs.js

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTQxMjAxNGE5YzY2NzkxY2Y0MTFjZjAiLCJpYXQiOjE3NjU4ODIwNTAsImV4cCI6MTc2ODQ3NDA1MH0.aL2JJrh6jTCoE00CY3yHZBAMI9IHlL6o__lh_LvFyRI';
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Generate realistic values based on sensor type
function generateValue(sensorType, hour, baseValue) {
  const hourOfDay = hour % 24;
  
  switch (sensorType) {
    case 'temperature':
      // Temperature varies throughout the day (cooler at night, warmer during day)
      const baseTemp = baseValue || 22;
      const dailyVariation = Math.sin((hourOfDay - 6) * Math.PI / 12) * 5; // ±5°C variation
      const randomVariation = (Math.random() - 0.5) * 2; // ±1°C random
      return Math.round((baseTemp + dailyVariation + randomVariation) * 10) / 10;
      
    case 'airMoisture':
      // Air moisture varies (higher at night, lower during day)
      const baseAirMoisture = baseValue || 50;
      const airVariation = Math.sin((hourOfDay - 6) * Math.PI / 12) * -10; // Inverse of temperature
      const airRandom = (Math.random() - 0.5) * 4; // ±2% random
      return Math.max(20, Math.min(90, Math.round((baseAirMoisture + airVariation + airRandom) * 10) / 10));
      
    case 'groundMoisture':
      // Ground moisture decreases slowly, then increases (watering effect)
      const baseGroundMoisture = baseValue || 45;
      const groundTrend = -0.1 * (hour % 24); // Slowly decreases
      const groundRandom = (Math.random() - 0.5) * 3; // ±1.5% random
      // Simulate watering every 12 hours
      const wateringBoost = (hour % 24 === 8 || hour % 24 === 20) ? 15 : 0;
      return Math.max(15, Math.min(85, Math.round((baseGroundMoisture + groundTrend + groundRandom + wateringBoost) * 10) / 10));
      
    case 'pressure':
      // Atmospheric pressure varies slightly
      const basePressure = baseValue || 101325;
      const pressureVariation = (Math.random() - 0.5) * 500; // ±250 Pa
      return Math.round(basePressure + pressureVariation);
      
    case 'light':
      // Light intensity varies dramatically (dark at night, bright during day)
      const baseLight = baseValue || 500;
      if (hourOfDay >= 6 && hourOfDay <= 18) {
        // Daytime: peak around noon
        const lightIntensity = Math.sin((hourOfDay - 6) * Math.PI / 12) * 800;
        const lightRandom = (Math.random() - 0.5) * 200;
        return Math.max(100, Math.round(baseLight + lightIntensity + lightRandom));
      } else {
        // Nighttime: very low light
        return Math.round(Math.random() * 50);
      }
      
    case 'ph':
      // pH stays relatively stable
      const basePh = baseValue || 6.5;
      const phVariation = (Math.random() - 0.5) * 0.5; // ±0.25 pH
      return Math.max(4.0, Math.min(9.0, Math.round((basePh + phVariation) * 10) / 10));
      
    default:
      return baseValue || 0;
  }
}

async function fetchWithAuth(url) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function postWithAuth(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function populateLogs() {
  try {
    console.log('Fetching plants...');
    const plants = await fetchWithAuth(`${API_BASE}/api/plants`);
    console.log(`Found ${plants.length} plants`);

    if (plants.length === 0) {
      console.log('No plants found. Exiting.');
      return;
    }

    // Calculate previous day range (24 hours ago to now)
    const now = new Date();
    
    // Generate logs every hour for the past 24 hours
    const hoursToGenerate = 24;
    
    let totalLogsCreated = 0;

    for (const plant of plants) {
      console.log(`\nProcessing plant: ${plant.nickname} (${plant._id})`);
      
      // Get sensors for this plant
      const sensors = await fetchWithAuth(`${API_BASE}/api/plants/${plant._id}/sensors`);
      console.log(`  Found ${sensors.length} sensors`);

      if (sensors.length === 0) {
        console.log(`  No sensors found for this plant. Skipping.`);
        continue;
      }

      for (const sensor of sensors) {
        console.log(`  Processing sensor: ${sensor.name} (${sensor.type})`);
        
        // Get the latest log to use as base value (if exists)
        let baseValue;
        try {
          const existingLogs = await fetchWithAuth(`${API_BASE}/api/sensors/${sensor._id}/logs?limit=1`);
          if (existingLogs.logs && existingLogs.logs.length > 0) {
            baseValue = existingLogs.logs[0].readings.value;
          }
        } catch (err) {
          // No existing logs, use default
        }

        let sensorLogsCreated = 0;
        
        // Generate logs for each hour
        for (let hourOffset = hoursToGenerate - 1; hourOffset >= 0; hourOffset--) {
          const logTime = new Date(now);
          logTime.setHours(logTime.getHours() - hourOffset);
          logTime.setMinutes(Math.floor(Math.random() * 60)); // Random minute within the hour
          logTime.setSeconds(Math.floor(Math.random() * 60)); // Random second
          
          const value = generateValue(sensor.type, logTime.getHours(), baseValue);
          
          try {
            await postWithAuth(`${API_BASE}/api/sensors/${sensor._id}/logs`, {
              value: value,
              timestamp: logTime.toISOString(),
            });
            
            sensorLogsCreated++;
            totalLogsCreated++;
            
            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(`    Error creating log: ${err.message}`);
          }
        }
        
        console.log(`    Created ${sensorLogsCreated} logs for ${sensor.name}`);
      }
    }

    console.log(`\n✅ Successfully created ${totalLogsCreated} sensor logs for the previous day!`);
  } catch (error) {
    console.error('Error populating logs:', error.message);
    process.exit(1);
  }
}

// Run the script
populateLogs();

