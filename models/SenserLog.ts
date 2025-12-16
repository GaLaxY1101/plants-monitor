import mongoose, { Schema, Document } from 'mongoose';

export interface ISensorLog extends Document {
  timestamp: Date;
  metadata: {
    plantId: mongoose.Types.ObjectId;
  };
  readings: {
    temperature: number;
    airMoisture: number;
    groundMoisture: number;
  };
}

const SensorLogSchema = new Schema<ISensorLog>({
  timestamp: { 
    type: Date, 
    required: true 
  },
  metadata: {
    plantId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Plant', 
      required: true 
    },
    location: String
  },
  readings: {
    temperature: Number,
    airMoisture: Number,
    groundMoisture: Number,
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