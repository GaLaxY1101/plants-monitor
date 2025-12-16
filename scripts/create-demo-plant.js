// Script to create a demo plant showing specific prediction scenarios
// Usage: node scripts/create-demo-plant.js

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OTQxMjAxNGE5YzY2NzkxY2Y0MTFjZjAiLCJpYXQiOjE3NjU4ODIwNTAsImV4cCI6MTc2ODQ3NDA1MH0.aL2JJrh6jTCoE00CY3yHZBAMI9IHlL6o__lh_LvFyRI';
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

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

async function createDemoPlant() {
  try {
    console.log('Fetching available species...');
    const speciesResponse = await fetchWithAuth(`${API_BASE}/api/species`);
    const species = speciesResponse.data || speciesResponse || [];
    console.log(`Found ${species.length} species`);
    
    if (species.length === 0) {
      console.log('No species found. Cannot create plant.');
      return;
    }
    
    // Use first species with ideal conditions
    const selectedSpecies = species.find(s => 
      s.idealConditions?.groundMoisture?.min && 
      s.idealConditions?.groundMoisture?.max &&
      s.idealConditions?.temperature?.min &&
      s.idealConditions?.temperature?.max
    ) || species[0];
    
    console.log(`Using species: ${selectedSpecies.name}`);
    console.log(`Ideal conditions:`);
    console.log(`  Temperature: ${selectedSpecies.idealConditions.temperature.min}-${selectedSpecies.idealConditions.temperature.max}°C`);
    console.log(`  Ground Moisture: ${selectedSpecies.idealConditions.groundMoisture.min}-${selectedSpecies.idealConditions.groundMoisture.max}%`);
    
    // Create a new plant
    console.log('\nCreating new plant...');
    const plantData = await postWithAuth(`${API_BASE}/api/plants`, {
      nickname: 'Demo Flower',
      speciesId: selectedSpecies._id,
    });
    
    const plantId = plantData.plant._id;
    console.log(`✅ Created plant: ${plantData.plant.nickname} (${plantId})`);
    
    // Create sensors
    console.log('\nCreating sensors...');
    const sensorsToCreate = [
      { deviceId: `TEMP-DEMO-${Date.now()}`, name: 'Temperature Sensor', type: 'temperature', location: 'Near plant' },
      { deviceId: `SOIL-DEMO-${Date.now()}`, name: 'Soil Moisture Sensor', type: 'groundMoisture', location: 'In soil' },
    ];
    
    const createdSensors = [];
    for (const sensorData of sensorsToCreate) {
      const sensor = await postWithAuth(`${API_BASE}/api/sensors/manage`, {
        ...sensorData,
        plantId: plantId,
      });
      createdSensors.push(sensor);
      console.log(`  ✅ Created sensor: ${sensor.name} (${sensor.type})`);
    }
    
    const tempSensor = createdSensors.find(s => s.type === 'temperature');
    const soilSensor = createdSensors.find(s => s.type === 'groundMoisture');
    
    // Get ideal ranges
    const tempMin = selectedSpecies.idealConditions.temperature.min;
    const tempMax = selectedSpecies.idealConditions.temperature.max;
    const tempMid = (tempMin + tempMax) / 2;
    
    const soilMin = selectedSpecies.idealConditions.groundMoisture.min;
    const soilMax = selectedSpecies.idealConditions.groundMoisture.max;
    const soilMid = (soilMin + soilMax) / 2;
    
    console.log('\nGenerating sensor logs with specific trends...');
    const now = new Date();
    const hoursToGenerate = 72; // 3 days
    
    // Scenario 2a: Temperature - Within range, trend moving UP (will go above max)
    // Start 3 days ago below midpoint, trend UP, currently near max, will exceed soon
    console.log('\n  Scenario 2a: Temperature - Within range, trending UP');
    const tempTargetHours = 20; // Will exceed max in 20 hours
    const tempCurrentValue = tempMax - 1; // Currently 1°C below max (within range)
    const tempHourlyChange = (tempMax - tempCurrentValue + 1) / tempTargetHours; // Calculate hourly change
    const tempStartValue = tempCurrentValue - (hoursToGenerate * tempHourlyChange); // Value 3 days ago
    
    let tempLogsCreated = 0;
    for (let hourOffset = hoursToGenerate - 1; hourOffset >= 0; hourOffset--) {
      const logTime = new Date(now);
      logTime.setHours(logTime.getHours() - hourOffset);
      logTime.setMinutes(Math.floor(Math.random() * 60));
      logTime.setSeconds(Math.floor(Math.random() * 60));
      
      // Calculate value: start value + (hours from start * hourly change)
      const hoursFromStart = hoursToGenerate - 1 - hourOffset;
      const value = tempStartValue + (hoursFromStart * tempHourlyChange);
      
      try {
        await postWithAuth(`${API_BASE}/api/sensors/${tempSensor._id}/logs`, {
          value: Math.round(value * 10) / 10,
          timestamp: logTime.toISOString(),
        });
        tempLogsCreated++;
        await new Promise(resolve => setTimeout(resolve, 20));
      } catch (err) {
        console.error(`    Error: ${err.message}`);
      }
    }
    const tempFinalValue = tempStartValue + ((hoursToGenerate - 1) * tempHourlyChange);
    console.log(`    Created ${tempLogsCreated} logs. Current: ${tempFinalValue.toFixed(1)}°C (ideal: ${tempMin}-${tempMax}°C), Trend: +${tempHourlyChange.toFixed(3)}/hour`);
    console.log(`    Expected: Scheduled cooling in ~${tempTargetHours} hours`);
    
    // Scenario 2b: Ground Moisture - Within range, trend moving DOWN (will go below min)
    // Start 3 days ago above midpoint, trend DOWN, currently near min, will go below soon
    console.log('\n  Scenario 2b: Ground Moisture - Within range, trending DOWN');
    const soilTargetHours = 18; // Will go below min in 18 hours
    const soilCurrentValue = soilMin + 2; // Currently 2% above min (within range)
    const soilHourlyChangeDown = -(soilCurrentValue - soilMin + 1) / soilTargetHours; // Negative change
    const soilStartValue = soilCurrentValue - (hoursToGenerate * soilHourlyChangeDown); // Value 3 days ago
    
    let soilLogsCreated = 0;
    for (let hourOffset = hoursToGenerate - 1; hourOffset >= 0; hourOffset--) {
      const logTime = new Date(now);
      logTime.setHours(logTime.getHours() - hourOffset);
      logTime.setMinutes(Math.floor(Math.random() * 60));
      logTime.setSeconds(Math.floor(Math.random() * 60));
      
      const hoursFromStart = hoursToGenerate - 1 - hourOffset;
      const value = soilStartValue + (hoursFromStart * soilHourlyChangeDown);
      
      try {
        await postWithAuth(`${API_BASE}/api/sensors/${soilSensor._id}/logs`, {
          value: Math.round(value * 10) / 10,
          timestamp: logTime.toISOString(),
        });
        soilLogsCreated++;
        await new Promise(resolve => setTimeout(resolve, 20));
      } catch (err) {
        console.error(`    Error: ${err.message}`);
      }
    }
    const soilFinalValue = soilStartValue + ((hoursToGenerate - 1) * soilHourlyChangeDown);
    console.log(`    Created ${soilLogsCreated} logs. Current: ${soilFinalValue.toFixed(1)}% (ideal: ${soilMin}-${soilMax}%), Trend: ${soilHourlyChangeDown.toFixed(3)}/hour`);
    console.log(`    Expected: Scheduled watering in ~${soilTargetHours} hours`);
    
    // Scenario 3: Create another sensor or use airMoisture for "out of range, trending towards"
    // Let's add airMoisture sensor for this scenario
    console.log('\n  Creating Air Moisture sensor for Scenario 3...');
    const airSensorData = await postWithAuth(`${API_BASE}/api/sensors/manage`, {
      deviceId: `AIR-DEMO-${Date.now()}`,
      name: 'Air Moisture Sensor',
      type: 'airMoisture',
      plantId: plantId,
      location: 'Near plant',
    });
    console.log(`  ✅ Created sensor: ${airSensorData.name}`);
    
    // Scenario 3: Air Moisture - Below min, trend moving UP (will reach within 48 hours)
    console.log('\n  Scenario 3: Air Moisture - Below min, trending UP');
    const airMin = selectedSpecies.idealConditions.airMoisture.min;
    const airMax = selectedSpecies.idealConditions.airMoisture.max;
    const airTargetHours = 25; // Will reach min in 25 hours (within 48h limit)
    const airCurrentValue = airMin - 3; // Currently 3% below minimum
    const airHourlyChangeUp = (airMin - airCurrentValue + 1) / airTargetHours; // Positive change
    const airStartValue = airCurrentValue - (hoursToGenerate * airHourlyChangeUp); // Value 3 days ago (even lower)
    
    let airLogsCreated = 0;
    for (let hourOffset = hoursToGenerate - 1; hourOffset >= 0; hourOffset--) {
      const logTime = new Date(now);
      logTime.setHours(logTime.getHours() - hourOffset);
      logTime.setMinutes(Math.floor(Math.random() * 60));
      logTime.setSeconds(Math.floor(Math.random() * 60));
      
      const hoursFromStart = hoursToGenerate - 1 - hourOffset;
      const value = airStartValue + (hoursFromStart * airHourlyChangeUp);
      
      try {
        await postWithAuth(`${API_BASE}/api/sensors/${airSensorData._id}/logs`, {
          value: Math.round(value * 10) / 10,
          timestamp: logTime.toISOString(),
        });
        airLogsCreated++;
        await new Promise(resolve => setTimeout(resolve, 20));
      } catch (err) {
        console.error(`    Error: ${err.message}`);
      }
    }
    const airFinalValue = airStartValue + ((hoursToGenerate - 1) * airHourlyChangeUp);
    console.log(`    Created ${airLogsCreated} logs. Current: ${airFinalValue.toFixed(1)}% (ideal: ${airMin}-${airMax}%), Trend: +${airHourlyChangeUp.toFixed(3)}/hour`);
    console.log(`    Expected: Scheduled action in ~${airTargetHours} hours`);
    
    console.log(`\n✅ Successfully created demo plant with ${tempLogsCreated + soilLogsCreated + airLogsCreated} sensor logs!`);
    console.log(`\nPlant ID: ${plantId}`);
    console.log(`View it at: ${API_BASE}/plants/${plantId}`);
    console.log('\nExpected Scenarios:');
    console.log('  Scenario 2a: Temperature - Within range, trending UP (will exceed max) → Scheduled cooling');
    console.log('  Scenario 2b: Ground Moisture - Within range, trending DOWN (will go below min) → Scheduled watering');
    console.log('  Scenario 3: Air Moisture - Below min, trending UP (will reach within 48h) → Scheduled action');
    
  } catch (error) {
    console.error('Error creating demo plant:', error.message);
    process.exit(1);
  }
}

// Run the script
createDemoPlant();

