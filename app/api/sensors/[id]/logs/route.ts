import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import { SensorLog } from '@/models/SenserLog';
import Sensor from '@/models/Sensor';
import Plant from '@/models/Plant';
import { getUserId } from '@/lib/auth';

// GET: Get sensor logs for a specific sensor
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
    const sensorId = resolvedParams.id;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Verify sensor exists and belongs to user's plant
    // Try by _id first, then by deviceId as fallback
    let sensor = await Sensor.findById(sensorId).populate('plantId');
    
    if (!sensor) {
      // Try finding by deviceId
      sensor = await Sensor.findOne({ deviceId: sensorId }).populate('plantId');
    }
    
    if (!sensor) {
      return NextResponse.json({ 
        message: 'Sensor not found',
        sensorId: sensorId 
      }, { status: 404 });
    }

    const plant = sensor.plantId as any;
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found for sensor' }, { status: 404 });
    }
    
    if (plant.ownerId.toString() !== userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Build query
    const query: any = {
      'metadata.sensorId': sensorId,
    };

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Fetch logs
    const logs = await SensorLog.find(query)
      .populate('metadata.sensorId')
      .populate('metadata.plantId')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);

    const total = await SensorLog.countDocuments(query);

    return NextResponse.json({
      logs,
      total,
      limit,
      skip,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      message: 'Error fetching sensor logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 });
  }
}

// POST: Create a new sensor log
export async function POST(
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
    const sensorId = resolvedParams.id;
    
    const body = await req.json();
    const { value, unit, timestamp } = body;

    if (value === undefined || value === null) {
      return NextResponse.json({ message: 'Value is required' }, { status: 400 });
    }

    // Verify sensor exists and belongs to user's plant
    // Try by _id first, then by deviceId as fallback
    let sensor = await Sensor.findById(sensorId).populate('plantId');
    
    if (!sensor) {
      // Try finding by deviceId
      sensor = await Sensor.findOne({ deviceId: sensorId }).populate('plantId');
    }
    
    if (!sensor) {
      return NextResponse.json({ 
        message: 'Sensor not found',
        sensorId: sensorId 
      }, { status: 404 });
    }

    const plant = sensor.plantId as any;
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found for sensor' }, { status: 404 });
    }
    
    if (plant.ownerId.toString() !== userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Get default unit based on sensor type if not provided
    const getDefaultUnit = (sensorType: string): string => {
      const unitMap: Record<string, string> = {
        temperature: '°C',
        airMoisture: '%',
        groundMoisture: '%',
        pressure: 'Pa',
        light: 'lux',
        ph: 'pH',
      };
      return unitMap[sensorType] || '';
    };

    // Create log entry
    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUnit = unit || getDefaultUnit(sensor.type);

    const newLog = await SensorLog.create({
      timestamp: logTimestamp,
      metadata: {
        sensorId: sensor._id,
        plantId: plant._id,
      },
      readings: {
        value,
        unit: logUnit,
      },
    });

    // Populate references for response
    await newLog.populate('metadata.sensorId');
    await newLog.populate('metadata.plantId');

    return NextResponse.json(newLog, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ 
      message: 'Error creating sensor log',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 });
  }
}

