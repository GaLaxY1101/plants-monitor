import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import Sensor from '@/models/Sensor';
import { SensorLog } from '@/models/SenserLog';
import { getUserId } from '@/lib/auth';

// GET: Get latest status for a plant from SensorLogs
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plantId = params.id;

    // Verify plant exists and belongs to user
    const plant = await Plant.findOne({ _id: plantId, ownerId: userId });
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found' }, { status: 404 });
    }

    // Get all sensors for this plant
    const sensors = await Sensor.find({ plantId });

    // Get latest reading for each sensor type
    const latestStatus: Record<string, { value: number; unit: string; timestamp: Date }> = {};

    for (const sensor of sensors) {
      const latestLog = await SensorLog.findOne({ 'metadata.sensorId': sensor._id })
        .sort({ timestamp: -1 });

      if (latestLog) {
        latestStatus[sensor.type] = {
          value: latestLog.readings.value,
          unit: latestLog.readings.unit || '',
          timestamp: latestLog.timestamp,
        };
      }
    }

    // Get the most recent timestamp from all readings
    const timestamps = Object.values(latestStatus).map(s => s.timestamp);
    const latestTimestamp = timestamps.length > 0 
      ? new Date(Math.max(...timestamps.map(t => t.getTime())))
      : null;

    return NextResponse.json({
      status: latestStatus,
      timestamp: latestTimestamp,
    });
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching plant status' }, { status: 500 });
  }
}

