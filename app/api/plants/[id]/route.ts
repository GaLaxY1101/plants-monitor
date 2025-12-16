import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import Sensor from '@/models/Sensor';
import { SensorLog } from '@/models/SenserLog';
import { getUserId } from '@/lib/auth';

// DELETE: Delete a plant and all associated sensors and logs
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await Promise.resolve(params);
    const plantId = resolvedParams.id;

    // Verify plant exists and belongs to user
    const plant = await Plant.findOne({ _id: plantId, ownerId: userId });
    
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found' }, { status: 404 });
    }

    // Find all sensors for this plant
    const sensors = await Sensor.find({ plantId });
    const sensorIds = sensors.map(sensor => sensor._id);

    // Delete all sensor logs for these sensors
    if (sensorIds.length > 0) {
      await SensorLog.deleteMany({
        'metadata.sensorId': { $in: sensorIds }
      });
    }

    // Delete all sensors for this plant
    await Sensor.deleteMany({ plantId });

    // Delete the plant
    await Plant.deleteOne({ _id: plantId });

    return NextResponse.json({ 
      message: 'Plant and all associated data deleted successfully',
      deleted: {
        plant: 1,
        sensors: sensors.length,
        logs: 'all'
      }
    });
  } catch (error: any) {
    console.error('Error deleting plant:', error);
    return NextResponse.json(
      {
        message: 'Error deleting plant',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

