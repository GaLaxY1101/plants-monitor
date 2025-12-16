import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import Sensor from '@/models/Sensor';
import { getUserId } from '@/lib/auth';

// GET: Get all sensors for a specific plant
export async function GET(
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

    // Get all sensors for this plant
    const sensors = await Sensor.find({ plantId })
      .sort({ createdAt: -1 });

    return NextResponse.json(sensors);
  } catch (error: any) {
    return NextResponse.json({ 
      message: 'Error fetching sensors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 });
  }
}

