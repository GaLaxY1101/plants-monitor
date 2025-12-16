import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import { SensorLog } from '@/models/SenserLog';

export async function POST(req: Request) {
  await connectToDb();

  try {
    const { plantId, temperature, airMoisture, groundMoisture } = await req.json();

    if (!plantId) {
      return NextResponse.json({ message: 'Plant ID required' }, { status: 400 });
    }

    // 1. Find Plant
    const plant = await Plant.findById(plantId);
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found' }, { status: 404 });
    }

    const now = new Date();

    // 2. Update "Real-time" status on the plant itself
    plant.latestStatus = {
      temperature,
      airMoisture,
      groundMoisture,
      timestamp: now
    };
    await plant.save();

    // 3. Logic: Should we save to History (SensorLog)?
    // Get the most recent log for this plant
    const lastLog = await SensorLog.findOne({ 'metadata.plantId': plantId })
      .sort({ timestamp: -1 });

    const oneHour = 60 * 60 * 1000;
    // Save if no logs exist OR last log was > 1 hour ago
    const shouldSaveHistory = !lastLog || (now.getTime() - lastLog.timestamp.getTime() > oneHour);

    if (shouldSaveHistory) {
      await SensorLog.create({
        timestamp: now,
        metadata: { plantId: plantId },
        readings: {
          temperature,
          airMoisture,
          groundMoisture
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