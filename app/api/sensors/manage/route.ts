import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Sensor from '@/models/Sensor';
import { getUserId } from '@/lib/auth';

// GET: Get all sensors for plants owned by the authenticated user
export async function GET(req: Request) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get sensors for plants owned by this user
    const Plant = (await import('@/models/Plant')).default;
    const userPlants = await Plant.find({ ownerId: userId }).select('_id');
    const plantIds = userPlants.map(p => p._id);
    
    const sensors = await Sensor.find({ plantId: { $in: plantIds } })
      .populate('plantId')
      .sort({ createdAt: -1 });
      
    return NextResponse.json(sensors);
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching sensors' }, { status: 500 });
  }
}

// POST: Create a new sensor and assign it to a plant
export async function POST(req: Request) {
  await connectToDb();
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { deviceId, name, plantId, type, location } = body;

    if (!deviceId || !name || !plantId || !type) {
      return NextResponse.json({ message: 'Missing required fields (deviceId, name, plantId, type)' }, { status: 400 });
    }

    // Verify plant exists and belongs to user
    const Plant = (await import('@/models/Plant')).default;
    const plant = await Plant.findOne({ _id: plantId, ownerId: userId });
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found or unauthorized' }, { status: 404 });
    }

    // Check if deviceId already exists
    const existingSensor = await Sensor.findOne({ deviceId });
    if (existingSensor) {
      return NextResponse.json({ message: 'Sensor with this device ID already exists' }, { status: 400 });
    }

    // Validate sensor type
    const validTypes = ['temperature', 'airMoisture', 'groundMoisture', 'pressure', 'light', 'ph'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ message: `Invalid sensor type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const newSensor = await Sensor.create({
      deviceId,
      name,
      plantId,
      type,
      location,
    });

    return NextResponse.json(newSensor, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ 
      message: 'Error creating sensor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 });
  }
}

