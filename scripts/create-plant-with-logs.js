// Script to create a new plant with sensors and populate logs
// Usage: node scripts/create-plant-with-logs.js

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

// Generate realistic values based on sensor type
function generateValue(sensorType, hour, baseValue, trend = 'normal') {
  const hourOfDay = hour % 24;
  
  switch (sensorType) {
    case 'temperature':
      const baseTemp = baseValue || 22;
      let tempValue;
      if (trend === 'low') {
        // Temperature is too low and decreasing
        tempValue = baseTemp - 5 - (Math.random() * 3);
      } else if (trend === 'high') {
        // Temperature is too high and increasing
        tempValue = baseTemp + 8 + (Math.random() * 3);
      } else {
        // Normal variation
        const dailyVariation = Math.sin((hourOfDay - 6) * Math.PI / 12) * 5;
        const randomVariation = (Math.random() - 0.5) * 2;
        tempValue = baseTemp + dailyVariation + randomVariation;
      }
      return Math.round(tempValue * 10) / 10;
      
    case 'airMoisture':
      const baseAirMoisture = baseValue || 50;
      let airValue;
      if (trend === 'low') {
        airValue = baseAirMoisture - 15 - (Math.random() * 5);
      } else if (trend === 'high') {
        airValue = baseAirMoisture + 20 + (Math.random() * 5);
      } else {
        const airVariation = Math.sin((hourOfDay - 6) * Math.PI / 12) * -10;
        const airRandom = (Math.random() - 0.5) * 4;
        airValue = baseAirMoisture + airVariation + airRandom;
      }
      return Math.max(20, Math.min(90, Math.round(airValue * 10) / 10));
      
    case 'groundMoisture':
      const baseGroundMoisture = baseValue || 45;
      let groundValue;
      if (trend === 'low') {
        // Ground moisture is low and decreasing (needs watering)
        groundValue = baseGroundMoisture - 20 - (Math.random() * 5);
      } else if (trend === 'high') {
        groundValue = baseGroundMoisture + 15 + (Math.random() * 5);
      } else {
        const groundTrend = -0.1 * (hour % 24);
        const groundRandom = (Math.random() - 0.5) * 3;
        const wateringBoost = (hour % 24 === 8 || hour % 24 === 20) ? 15 : 0;
        groundValue = baseGroundMoisture + groundTrend + groundRandom + wateringBoost;
      }
      return Math.max(15, Math.min(85, Math.round(groundValue * 10) / 10));
      
    default:
      return baseValue || 0;
  }
}

async function createPlantWithLogs() {
  try {
    console.log('Fetching available species...');
    const speciesResponse = await fetchWithAuth(`${API_BASE}/api/species`);
    // Handle different response formats
    const species = speciesResponse.data || speciesResponse || [];
    console.log(`Found ${species.length} species`);
    
    if (species.length === 0) {
      console.log('No species found. Cannot create plant.');
      return;
    }
    
    // Use a species that has ideal conditions (prefer one with higher moisture needs for better demo)
    const selectedSpecies = species.find(s => 
      s.idealConditions?.groundMoisture?.min && 
      s.idealConditions?.groundMoisture?.max
    ) || species[0];
    console.log(`Using species: ${selectedSpecies.name}`);
    
    // Create a new plant
    console.log('\nCreating new plant...');
    const plantData = await postWithAuth(`${API_BASE}/api/plants`, {
      nickname: 'Rose Garden',
      speciesId: selectedSpecies._id,
    });
    
    const plantId = plantData.plant._id;
    console.log(`✅ Created plant: ${plantData.plant.nickname} (${plantId})`);
    
    // Create sensors for the plant
    console.log('\nCreating sensors...');
    const sensorsToCreate = [
      { deviceId: `TEMP-${Date.now()}`, name: 'Temperature Sensor', type: 'temperature', location: 'Top shelf' },
      { deviceId: `AIR-${Date.now()}`, name: 'Air Humidity Sensor', type: 'airMoisture', location: 'Near plant' },
      { deviceId: `SOIL-${Date.now()}`, name: 'Soil Moisture Sensor', type: 'groundMoisture', location: 'In soil' },
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
    
    // Generate logs for the past 3 days with different trends to show recommendations
    console.log('\nGenerating sensor logs...');
    const now = new Date();
    const hoursToGenerate = 72; // 3 days
    
    let totalLogsCreated = 0;
    
    for (const sensor of createdSensors) {
      console.log(`  Processing sensor: ${sensor.name} (${sensor.type})`);
      
      // Determine trend based on sensor type to create interesting recommendations
      let trend = 'normal';
      if (sensor.type === 'groundMoisture') {
        trend = 'low'; // Show watering recommendation
      } else if (sensor.type === 'temperature') {
        trend = 'high'; // Show cooling recommendation
      }
      
      let sensorLogsCreated = 0;
      
      // Generate logs for each hour
      for (let hourOffset = hoursToGenerate - 1; hourOffset >= 0; hourOffset--) {
        const logTime = new Date(now);
        logTime.setHours(logTime.getHours() - hourOffset);
        logTime.setMinutes(Math.floor(Math.random() * 60));
        logTime.setSeconds(Math.floor(Math.random() * 60));
        
        // Use ideal conditions as base, then apply trend
        let baseValue;
        if (sensor.type === 'temperature' && selectedSpecies.idealConditions?.temperature) {
          baseValue = (selectedSpecies.idealConditions.temperature.min + selectedSpecies.idealConditions.temperature.max) / 2;
        } else if (sensor.type === 'airMoisture' && selectedSpecies.idealConditions?.airMoisture) {
          baseValue = (selectedSpecies.idealConditions.airMoisture.min + selectedSpecies.idealConditions.airMoisture.max) / 2;
        } else if (sensor.type === 'groundMoisture' && selectedSpecies.idealConditions?.groundMoisture) {
          baseValue = (selectedSpecies.idealConditions.groundMoisture.min + selectedSpecies.idealConditions.groundMoisture.max) / 2;
        }
        
        const value = generateValue(sensor.type, logTime.getHours(), baseValue, trend);
        
        try {
          await postWithAuth(`${API_BASE}/api/sensors/${sensor._id}/logs`, {
            value: value,
            timestamp: logTime.toISOString(),
          });
          
          sensorLogsCreated++;
          totalLogsCreated++;
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 30));
        } catch (err) {
          console.error(`    Error creating log: ${err.message}`);
        }
      }
      
      console.log(`    Created ${sensorLogsCreated} logs`);
    }
    
    console.log(`\n✅ Successfully created plant with ${totalLogsCreated} sensor logs!`);
    console.log(`\nPlant ID: ${plantId}`);
    console.log(`View it at: ${API_BASE}/plants/${plantId}`);
    
  } catch (error) {
    console.error('Error creating plant:', error.message);
    process.exit(1);
  }
}

// Run the script
createPlantWithLogs();

