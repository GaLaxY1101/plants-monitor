import mongoose, { Schema, Document, Model } from 'mongoose';
import { IPlant } from './Plant';

// Sensor types - what it measures
export type SensorType = 
  | 'temperature' 
  | 'airMoisture' 
  | 'groundMoisture' 
  | 'pressure' 
  | 'light' 
  | 'ph';

// 1. Interface (TypeScript)
export interface ISensor extends Document {
  deviceId: string; // Unique identifier from the IoT device (e.g., MAC address, serial number)
  name: string; // User-friendly name for the sensor
  plantId: mongoose.Types.ObjectId | IPlant; // Which plant this sensor monitors
  type: SensorType; // What this sensor measures
  location?: string; // Optional location description
  createdAt: Date;
  updatedAt: Date;
}

// 2. Schema (Mongoose)
const SensorSchema: Schema<ISensor> = new Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  plantId: {
    type: Schema.Types.ObjectId,
    ref: 'Plant',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['temperature', 'airMoisture', 'groundMoisture', 'pressure', 'light', 'ph'],
    required: true,
  },
  location: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// 3. Export model
const Sensor: Model<ISensor> = 
  mongoose.models.Sensor || mongoose.model<ISensor>('Sensor', SensorSchema);

export default Sensor;

