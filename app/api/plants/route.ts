import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import Sensor from '@/models/Sensor';
import { getUserId } from '@/lib/auth';

// GET: Get all my plants
export async function GET(req: Request) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plants = await Plant.find({ ownerId: userId })
      .populate('species')
      .sort({ createdAt: -1 });
      
    return NextResponse.json(plants);
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching plants' }, { status: 500 });
  }
}

// POST: Create a new plant with optional sensors
export async function POST(req: Request) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nickname, speciesId, location, sensors } = body;

    if (!nickname || !speciesId) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    // Create plant
    const newPlant = await Plant.create({
      nickname,
      species: speciesId,
      ownerId: userId,
    });

    // Create sensors if provided
    const createdSensors = [];
    if (sensors && Array.isArray(sensors) && sensors.length > 0) {
      const validTypes = ['temperature', 'airMoisture', 'groundMoisture', 'pressure', 'light', 'ph'];
      
      for (const sensorData of sensors) {
        const { deviceId, name, type, location: sensorLocation } = sensorData;

        if (!deviceId || !name || !type) {
          continue; // Skip invalid sensors
        }

        // Validate sensor type
        if (!validTypes.includes(type)) {
          continue; // Skip invalid types
        }

        // Check if deviceId already exists
        const existingSensor = await Sensor.findOne({ deviceId });
        if (existingSensor) {
          continue; // Skip duplicate deviceIds
        }

        const newSensor = await Sensor.create({
          deviceId,
          name,
          plantId: newPlant._id,
          type,
          location: sensorLocation || location,
        });

        createdSensors.push(newSensor);
      }
    }

    return NextResponse.json({
      plant: newPlant,
      sensors: createdSensors,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ 
      message: 'Error creating plant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 });
  }
}