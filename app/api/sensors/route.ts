import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Sensor from '@/models/Sensor';
import Plant from '@/models/Plant';
import { SensorLog } from '@/models/SenserLog';

export async function POST(req: Request) {
  await connectToDb();

  try {
    // Sensors authenticate using deviceId and send a single reading value
    const { deviceId, value, unit } = await req.json();

    if (!deviceId || value === undefined) {
      return NextResponse.json({ message: 'Device ID and value required' }, { status: 400 });
    }

    // 1. Find Sensor by deviceId
    const sensor = await Sensor.findOne({ deviceId }).populate('plantId');
    if (!sensor) {
      return NextResponse.json({ message: 'Sensor not found' }, { status: 404 });
    }

    // 2. Get associated plant
    const plant = await Plant.findById(sensor.plantId);
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found for this sensor' }, { status: 404 });
    }

    const now = new Date();

    // 3. Logic: Should we save to History (SensorLog)?
    // Get the most recent log for this sensor
    const lastLog = await SensorLog.findOne({ 'metadata.sensorId': sensor._id })
      .sort({ timestamp: -1 });

    const oneHour = 60 * 60 * 1000;
    // Save if no logs exist OR last log was > 1 hour ago
    const shouldSaveHistory = !lastLog || (now.getTime() - lastLog.timestamp.getTime() > oneHour);

    if (shouldSaveHistory) {
      await SensorLog.create({
        timestamp: now,
        metadata: { 
          sensorId: sensor._id,
          plantId: plant._id 
        },
        readings: {
          value,
          unit: unit || getDefaultUnit(sensor.type),
        }
      });
      return NextResponse.json({ message: 'Status updated & Logged to History' });
    }

    return NextResponse.json({ message: 'Status updated (Live only)' });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Server Error' }, { status: 500 });
  }
}

// Helper function to get default unit for sensor type
function getDefaultUnit(sensorType: string): string {
  const unitMap: Record<string, string> = {
    temperature: '°C',
    airMoisture: '%',
    groundMoisture: '%',
    pressure: 'Pa',
    light: 'lux',
    ph: 'pH',
  };
  return unitMap[sensorType] || '';
}