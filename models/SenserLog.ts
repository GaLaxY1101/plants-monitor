import mongoose, { Schema, Document } from 'mongoose';

export interface ISensorLog extends Document {
  timestamp: Date;
  metadata: {
    sensorId: mongoose.Types.ObjectId; // Sensor that generated this reading
    plantId?: mongoose.Types.ObjectId; // Plant being monitored (for querying)
  };
  // Flexible readings - each sensor type measures different things
  readings: {
    value: number; // The actual measurement value
    unit?: string; // Unit of measurement (e.g., '°C', '%', 'Pa', 'lux', 'pH')
  };
}

const SensorLogSchema = new Schema<ISensorLog>({
  timestamp: { 
    type: Date, 
    required: true 
  },
  metadata: {
    sensorId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Sensor', 
      required: true 
    },
    plantId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Plant',
    },
    location: String
  },
  readings: {
    value: { type: Number, required: true }, // The measurement value
    unit: String, // Unit of measurement
  }
}, {
  // TIMESERIES
  timeseries: {
    timeField: 'timestamp',
    metaField: 'metadata',
    granularity: 'hours' 
  },
  // Автоматичне видалення старих даних (наприклад, через 1 рік), щоб не забивати базу
  expireAfterSeconds: 60 * 60 * 24 * 365 // 365 днів
});

export const SensorLog = mongoose.models.SensorLog || mongoose.model<ISensorLog>('SensorLog', SensorLogSchema);