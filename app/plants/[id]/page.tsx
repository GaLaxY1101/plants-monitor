'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  AppBar,
  Toolbar,
  Avatar,
  Menu,
  MenuItem,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Logout,
  ArrowBack,
  LocalFlorist,
  Thermostat,
  WaterDrop,
  Grass,
  Sensors,
  Add,
  History,
} from '@mui/icons-material';

interface PlantSpecies {
  _id: string;
  name: string;
  description?: string;
  idealConditions?: {
    temperature: { min: number; max: number };
    airMoisture: { min: number; max: number };
    groundMoisture: { min: number; max: number };
  };
}

interface PlantStatus {
  [key: string]: {
    value: number;
    unit: string;
    timestamp: Date;
  };
}

interface Plant {
  _id: string;
  nickname: string;
  species: PlantSpecies | string;
  createdAt: string;
}

interface Sensor {
  _id: string;
  deviceId: string;
  name: string;
  type: string;
  location?: string;
  createdAt: string;
}

export default function PlantDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const plantId = params.id as string;

  const [plant, setPlant] = useState<Plant | null>(null);
  const [plantStatus, setPlantStatus] = useState<PlantStatus | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [sensorLogs, setSensorLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [addSensorDialogOpen, setAddSensorDialogOpen] = useState(false);
  const [newSensor, setNewSensor] = useState({
    deviceId: '',
    name: '',
    type: '',
    location: '',
  });
  const [addingSensor, setAddingSensor] = useState(false);
  const [sensorError, setSensorError] = useState('');

  const SENSOR_TYPES = [
    { value: 'temperature', label: 'Temperature' },
    { value: 'airMoisture', label: 'Air Moisture' },
    { value: 'groundMoisture', label: 'Ground Moisture' },
    { value: 'pressure', label: 'Pressure' },
    { value: 'light', label: 'Light' },
    { value: 'ph', label: 'pH' },
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchPlant(token);
  }, [router, plantId]);

  const fetchPlant = async (token: string) => {
    try {
      const response = await fetch('/api/plants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch plant');
      }

      const plants = await response.json();
      const foundPlant = plants.find((p: Plant) => p._id === plantId);
      
      if (!foundPlant) {
        setError('Plant not found');
        return;
      }

      setPlant(foundPlant);

      // Fetch status for this plant
      try {
        const statusResponse = await fetch(`/api/plants/${plantId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('Status data received:', statusData);
          setPlantStatus(statusData.status || null);
        } else {
          const errorData = await statusResponse.json();
          console.error('Status fetch error:', errorData);
        }
      } catch (err) {
        console.error('Status fetch exception:', err);
      }

      // Fetch sensors for this plant
      await fetchSensors(token);
    } catch (err) {
      setError('Failed to load plant');
    } finally {
      setLoading(false);
    }
  };

  const fetchSensors = async (token: string) => {
    try {
      const sensorsResponse = await fetch(`/api/plants/${plantId}/sensors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (sensorsResponse.ok) {
        const sensorsData = await sensorsResponse.json();
        setSensors(sensorsData);
      }
    } catch (err) {
      console.error('Sensors fetch exception:', err);
    }
  };

  const handleAddSensor = () => {
    setNewSensor({ deviceId: '', name: '', type: '', location: '' });
    setSensorError('');
    setAddSensorDialogOpen(true);
  };

  const handleCloseAddSensor = () => {
    setAddSensorDialogOpen(false);
    setNewSensor({ deviceId: '', name: '', type: '', location: '' });
    setSensorError('');
  };

  const handleSubmitSensor = async () => {
    if (!newSensor.deviceId || !newSensor.name || !newSensor.type) {
      setSensorError('Please fill in all required fields');
      return;
    }

    setAddingSensor(true);
    setSensorError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/sensors/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: newSensor.deviceId,
          name: newSensor.name,
          type: newSensor.type,
          plantId: plantId,
          location: newSensor.location || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSensorError(data.message || 'Failed to create sensor');
        return;
      }

      // Success - refresh sensors list
      await fetchSensors(token);
      handleCloseAddSensor();
    } catch (err) {
      setSensorError('An error occurred. Please try again.');
    } finally {
      setAddingSensor(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getSpeciesName = (species: PlantSpecies | string): string => {
    if (typeof species === 'string') return 'Unknown';
    return species.name;
  };

  const getSpeciesData = (species: PlantSpecies | string): PlantSpecies | null => {
    if (typeof species === 'string') return null;
    return species;
  };

  const getStatusColor = (value: number, min: number, max: number): 'success' | 'warning' | 'error' => {
    if (value >= min && value <= max) return 'success';
    if (value < min * 0.8 || value > max * 1.2) return 'error';
    return 'warning';
  };

  const handleViewLogs = async (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setLogsDialogOpen(true);
    setLoadingLogs(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sensors/${sensor._id}/logs?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSensorLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleString();
  };

  if (!user) {
    return null;
  }

  const speciesData = plant ? getSpeciesData(plant.species) : null;

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Button
            color="inherit"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/plants')}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Plant Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1">{user.name}</Typography>
            <Avatar
              sx={{ bgcolor: 'secondary.main', cursor: 'pointer' }}
              onClick={handleMenuOpen}
            >
              {user.name.charAt(0).toUpperCase()}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => router.push('/plants')}>
                My Plants
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4, mb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : plant ? (
          <>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <LocalFlorist color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" component="h1">
                      {plant.nickname}
                    </Typography>
                    <Chip
                      label={getSpeciesName(plant.species)}
                      color="secondary"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddSensor}
                >
                  Add Sensor
                </Button>
              </Box>
              {speciesData?.description && (
                <Typography variant="body1" color="text.secondary">
                  {speciesData.description}
                </Typography>
              )}
            </Box>

            {/* Current Status Section */}
            {plantStatus && Object.keys(plantStatus).length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(3, 1fr)',
                  },
                  gap: 3,
                  mb: 4,
                }}
              >
                {plantStatus.temperature && (
                  <Box>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Thermostat color="error" sx={{ mr: 1, fontSize: 32 }} />
                          <Typography variant="h6">Temperature</Typography>
                        </Box>
                        <Typography variant="h4" gutterBottom>
                          {plantStatus.temperature.value}{plantStatus.temperature.unit || '°C'}
                        </Typography>
                        {speciesData?.idealConditions && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              Ideal: {speciesData.idealConditions.temperature.min}°C - {speciesData.idealConditions.temperature.max}°C
                            </Typography>
                            <Chip
                              label={
                                plantStatus.temperature.value >= speciesData.idealConditions.temperature.min &&
                                plantStatus.temperature.value <= speciesData.idealConditions.temperature.max
                                  ? 'Optimal'
                                  : 'Out of range'
                              }
                              color={getStatusColor(
                                plantStatus.temperature.value,
                                speciesData.idealConditions.temperature.min,
                                speciesData.idealConditions.temperature.max
                              )}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                )}

                {plantStatus.airMoisture && (
                  <Box>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <WaterDrop color="primary" sx={{ mr: 1, fontSize: 32 }} />
                          <Typography variant="h6">Air Moisture</Typography>
                        </Box>
                        <Typography variant="h4" gutterBottom>
                          {plantStatus.airMoisture.value}{plantStatus.airMoisture.unit || '%'}
                        </Typography>
                        {speciesData?.idealConditions && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              Ideal: {speciesData.idealConditions.airMoisture.min}% - {speciesData.idealConditions.airMoisture.max}%
                            </Typography>
                            <Chip
                              label={
                                plantStatus.airMoisture.value >= speciesData.idealConditions.airMoisture.min &&
                                plantStatus.airMoisture.value <= speciesData.idealConditions.airMoisture.max
                                  ? 'Optimal'
                                  : 'Out of range'
                              }
                              color={getStatusColor(
                                plantStatus.airMoisture.value,
                                speciesData.idealConditions.airMoisture.min,
                                speciesData.idealConditions.airMoisture.max
                              )}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                )}

                {plantStatus.groundMoisture && (
                  <Box>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Grass color="success" sx={{ mr: 1, fontSize: 32 }} />
                          <Typography variant="h6">Ground Moisture</Typography>
                        </Box>
                        <Typography variant="h4" gutterBottom>
                          {plantStatus.groundMoisture.value}{plantStatus.groundMoisture.unit || '%'}
                        </Typography>
                        {speciesData?.idealConditions && (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              Ideal: {speciesData.idealConditions.groundMoisture.min}% - {speciesData.idealConditions.groundMoisture.max}%
                            </Typography>
                            <Chip
                              label={
                                plantStatus.groundMoisture.value >= speciesData.idealConditions.groundMoisture.min &&
                                plantStatus.groundMoisture.value <= speciesData.idealConditions.groundMoisture.max
                                  ? 'Optimal'
                                  : 'Out of range'
                              }
                              color={getStatusColor(
                                plantStatus.groundMoisture.value,
                                speciesData.idealConditions.groundMoisture.min,
                                speciesData.idealConditions.groundMoisture.max
                              )}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                )}
              </Box>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No sensor data available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sensor readings will appear here once data is received from your IoT device.
                </Typography>
              </Paper>
            )}

            {/* Sensors Section */}
            <Box sx={{ mb: 4, mt: 4 }}>
              <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sensors />
                Sensors ({sensors.length})
              </Typography>
              {sensors.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No sensors configured
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Add sensors to start monitoring your plant
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddSensor}
                  >
                    Add Your First Sensor
                  </Button>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                    },
                    gap: 2,
                  }}
                >
                  {sensors.map((sensor) => (
                    <Box key={sensor._id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                            <Typography variant="h6">{sensor.name}</Typography>
                            <Chip
                              label={sensor.type}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Device ID: {sensor.deviceId}
                          </Typography>
                          {sensor.location && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Location: {sensor.location}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<History />}
                              onClick={() => handleViewLogs(sensor)}
                            >
                              View Logs
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </>
        ) : null}

        {/* Add Sensor Dialog */}
        <Dialog
          open={addSensorDialogOpen}
          onClose={handleCloseAddSensor}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add New Sensor</DialogTitle>
          <DialogContent>
            {sensorError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {sensorError}
              </Alert>
            )}
            <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                required
                fullWidth
                label="Device ID"
                placeholder="e.g., ESP32-001"
                value={newSensor.deviceId}
                onChange={(e) => setNewSensor({ ...newSensor, deviceId: e.target.value })}
              />
              <TextField
                required
                fullWidth
                label="Sensor Name"
                placeholder="e.g., Temperature Sensor"
                value={newSensor.name}
                onChange={(e) => setNewSensor({ ...newSensor, name: e.target.value })}
              />
              <FormControl fullWidth required>
                <InputLabel>Sensor Type</InputLabel>
                <Select
                  value={newSensor.type}
                  label="Sensor Type"
                  onChange={(e) => setNewSensor({ ...newSensor, type: e.target.value })}
                >
                  {SENSOR_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Location (Optional)"
                placeholder="e.g., Top of pot"
                value={newSensor.location}
                onChange={(e) => setNewSensor({ ...newSensor, location: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddSensor} disabled={addingSensor}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitSensor}
              variant="contained"
              disabled={addingSensor || !newSensor.deviceId || !newSensor.name || !newSensor.type}
            >
              {addingSensor ? 'Adding...' : 'Add Sensor'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Sensor Logs Dialog */}
        <Dialog
          open={logsDialogOpen}
          onClose={() => setLogsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Sensor Logs: {selectedSensor?.name}
          </DialogTitle>
          <DialogContent>
            {loadingLogs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : sensorLogs.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No logs available for this sensor
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell>Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sensorLogs.map((log: any) => (
                      <TableRow key={log._id}>
                        <TableCell>{formatDate(log.timestamp)}</TableCell>
                        <TableCell align="right">{log.readings.value}</TableCell>
                        <TableCell>{log.readings.unit || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogsDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}

