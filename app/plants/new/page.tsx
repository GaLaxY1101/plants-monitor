'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import { AddCircleOutlined } from '@mui/icons-material';

interface PlantSpecies {
  _id: string;
  name: string;
  description?: string;
}

export default function NewPlantPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [speciesId, setSpeciesId] = useState('');
  const [location, setLocation] = useState('');
  const [speciesList, setSpeciesList] = useState<PlantSpecies[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSpecies, setLoadingSpecies] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch available species
    const fetchSpecies = async () => {
      try {
        const response = await fetch('/api/species');
        const data = await response.json();
        
        if (data.success && data.data) {
          setSpeciesList(data.data);
        }
      } catch (err) {
        setError('Failed to load plant species');
      } finally {
        setLoadingSpecies(false);
      }
    };

    fetchSpecies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname,
          speciesId,
          ...(location && { location }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to create plant');
        return;
      }

      // Success - redirect to plants list
      router.push('/plants');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Box
            sx={{
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <AddCircleOutlined color="primary" sx={{ fontSize: 40 }} />
            <Typography component="h1" variant="h4">
              Add New Plant
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          {loadingSpecies ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="nickname"
                label="Plant Nickname"
                name="nickname"
                placeholder="e.g., My Rose Bush"
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <FormControl fullWidth margin="normal" required>
                <InputLabel id="species-label">Plant Species</InputLabel>
                <Select
                  labelId="species-label"
                  id="species"
                  value={speciesId}
                  label="Plant Species"
                  onChange={(e) => setSpeciesId(e.target.value)}
                >
                  {speciesList.length === 0 ? (
                    <MenuItem disabled>No species available</MenuItem>
                  ) : (
                    speciesList.map((species) => (
                      <MenuItem key={species._id} value={species._id}>
                        {species.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              <TextField
                margin="normal"
                fullWidth
                id="location"
                label="Location (Optional)"
                name="location"
                placeholder="e.g., Living Room, Garden"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !nickname || !speciesId}
              >
                {loading ? 'Creating...' : 'Add Plant'}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => router.push('/plants')}
                sx={{ mb: 2 }}
              >
                Cancel
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

