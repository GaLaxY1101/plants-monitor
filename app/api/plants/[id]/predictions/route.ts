import { NextResponse } from 'next/server';
import connectToDb from '@/lib/db';
import Plant from '@/models/Plant';
import Sensor from '@/models/Sensor';
import { SensorLog } from '@/models/SenserLog';
import PlantSpecies from '@/models/PlantSpecies';
import { getUserId } from '@/lib/auth';
import { computeForecastAndAction, SensorDataPoint } from '@/lib/predictions';

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

    const plant = await Plant.findOne({ _id: plantId, ownerId: userId })
      .populate('species');
    
    if (!plant) {
      return NextResponse.json({ message: 'Plant not found' }, { status: 404 });
    }

    const species = plant.species as any;
    if (!species || !species.idealConditions) {
      return NextResponse.json(
        { message: 'Plant species or ideal conditions not found' },
        { status: 404 }
      );
    }

    const sensors = await Sensor.find({ plantId });

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const predictions: Record<string, any> = {};

    const relevantSensorTypes: Array<'groundMoisture' | 'temperature' | 'airMoisture'> = [
      'groundMoisture',
      'temperature',
      'airMoisture',
    ];

    for (const sensor of sensors) {
      const sensorType = sensor.type;
      
      if (!relevantSensorTypes.includes(sensorType as any)) {
        continue;
      }
      
      const idealConditions = species.idealConditions?.[sensorType as keyof typeof species.idealConditions] as { min: number; max: number } | undefined;
      
      if (!idealConditions) {
        continue;
      }

      const logs = await SensorLog.find({
        'metadata.sensorId': sensor._id,
        timestamp: { $gte: threeDaysAgo },
      })
        .sort({ timestamp: 1 })
        .lean();

      if (logs.length === 0) {
        predictions[sensorType] = {
          status: 'no_data',
          message: `No sensor data available for ${sensorType} in the last 3 days`,
        };
        continue;
      }

      const dataPoints: SensorDataPoint[] = logs.map((log) => ({
        timestamp: new Date(log.timestamp),
        value: log.readings.value,
      }));

      const sensorName = sensor.name || `${sensorType} sensor`;

      const { readableText, info } = computeForecastAndAction(
        dataPoints,
        idealConditions.min,
        idealConditions.max,
        sensorType as 'groundMoisture' | 'temperature' | 'airMoisture',
        sensorName
      );

      predictions[sensorType] = {
        ...info,
        sensorId: sensor._id.toString(),
        sensorName: sensor.name,
        idealRange: {
          min: idealConditions.min,
          max: idealConditions.max,
        },
      };
    }

    return NextResponse.json({
      plantId: plant._id.toString(),
      plantName: plant.nickname,
      predictions,
      generatedAt: new Date(),
    });
  } catch (error: any) {
    console.error('Error generating predictions:', error);
    return NextResponse.json(
      {
        message: 'Error generating predictions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

