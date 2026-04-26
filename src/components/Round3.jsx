import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSimulation } from '../context/SimulationContext';
import { useGameSystem } from '../hooks/useGameSystem';
import { validateRound3Geo } from '../lib/apiClient';
import { LATITUDE_QUESTIONS, LONGITUDE_QUESTIONS } from '../utils/iplQuestions';

const DEFAULT_LOCATION_NAME = "Punjab Kings' New Stadium, Mullanpur";

const createCustomIcon = (color = '#10b981') => {
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="32" height="48"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}"/><circle cx="12" cy="12" r="5" fill="${color === '#10b981' ? '#0a0e1a' : '#080c12'}"/></svg>`,
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48],
  });
};

const MapUpdater = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.6 });
    }
  }, [lat, lng, map]);
  return null;
};

export default function Round3({ onComplete }) {
  const { user } = useSimulation();

  const [activeTab, setActiveTab] = useState('latitude'); // 'latitude', 'longitude', 'tracker'
  
  // Geo Tracker Inputs
  const [trackerLat, setTrackerLat] = useState('');
  const [trackerLon, setTrackerLon] = useState('');
  const [trackerError, setTrackerError] = useState('');
  const [isVerifyingGeo, setIsVerifyingGeo] = useState(false);
  const { cooldown, isFrozen } = useGameSystem(user?.teamName);

  // Victory State
  const [mapLocation, setMapLocation] = useState(null);

  // Display-only tabs for latitude/longitude (answers shown directly).
  const allQuestions = useMemo(() => [...LATITUDE_QUESTIONS, ...LONGITUDE_QUESTIONS], []);
  const latitudeQuestion = allQuestions.find((q) => q.section === 'latitude');
  const longitudeQuestion = allQuestions.find((q) => q.section === 'longitude');

  const handleGeoSubmit = async (event) => {
    event.preventDefault();
    if (!trackerLat || !trackerLon) {
      setTrackerError('BOTH COORDINATES REQUIRED');
      return;
    }

    try {
      setIsVerifyingGeo(true);
      setTrackerError('');
      
      const data = await validateRound3Geo(trackerLat, trackerLon);

      // Success
      setMapLocation({
        lat: Number(data.mapLocation.latitude) || 30.6942,
        lng: Number(data.mapLocation.longitude) || 76.7338,
        locationName: data.mapLocation.locationName || DEFAULT_LOCATION_NAME
      });

    } catch (err) {
      const msg = err.message || '';
      setTrackerError(msg.toUpperCase());
    } finally {
      setIsVerifyingGeo(false);
    }
  };

  // derived locked states
  const longitudeLocked = false;
  const trackerLocked = false;



  return (
    <div className="h-full flex flex-col gap-6 p-6" style={{ background: 'rgba(0,0,0,0.1)' }}>
      <div className="space-y-2">
        <h1 className="premium-heading text-3xl">ROUND 3: GEO TRACE TERMINAL</h1>
      </div>

      {!mapLocation ? (
        <div className="flex-1 flex flex-col rounded-lg border border-white/10 bg-black/90 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          {/* Tabs Header */}
          <div className="flex border-b border-white/10 bg-black/40">
            <button
              onClick={() => setActiveTab('latitude')}
              className={`flex-1 py-3 text-xs font-mono uppercase tracking-[0.1em] transition-all ${activeTab === 'latitude' ? 'text-green-400 border-b-2 border-green-400 bg-green-400/5' : 'text-white/40 hover:text-white/70'}`}
            >
              Latitude SEQ.
            </button>
            <button
              onClick={() => setActiveTab('longitude')}
              className={`flex-1 py-3 text-xs font-mono uppercase tracking-[0.1em] transition-all ${activeTab === 'longitude' ? 'text-green-400 border-b-2 border-green-400 bg-green-400/5' : 'text-white/40 hover:text-white/70'}`}
            >
              Longitude SEQ.
              {longitudeLocked && <span className="ml-2 opacity-50">🔒</span>}
            </button>
            <button
              onClick={() => setActiveTab('tracker')}
              className={`flex-1 py-3 text-xs font-mono uppercase tracking-[0.1em] transition-all ${activeTab === 'tracker' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-white/40 hover:text-white/70'}`}
            >
              Geo Tracker
              {trackerLocked && <span className="ml-2 opacity-50">🔒</span>}
            </button>
          </div>

          <div
            className="flex-1 p-5 md:p-6 overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.98), rgba(6,10,18,0.96))',
            }}
          >
            {/* TAB 1: LATITUDE */}
            {activeTab === 'latitude' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="text-cyan-300 text-xs font-mono tracking-[0.2em] uppercase">
                    LATITUDE CHALLENGE
                  </div>
                  <div className="text-white/90 text-sm leading-relaxed font-mono">
                    {latitudeQuestion?.question}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LONGITUDE */}
            {activeTab === 'longitude' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="text-cyan-300 text-xs font-mono tracking-[0.2em] uppercase">
                    LONGITUDE CHALLENGE
                  </div>
                  <div className="text-white/90 text-sm leading-relaxed font-mono">
                    {longitudeQuestion?.question}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GEO TRACKER */}
            {activeTab === 'tracker' && (
              <div className="space-y-6">
                <form onSubmit={handleGeoSubmit} className="max-w-md mx-auto space-y-8 py-8">
                  <div className="text-center font-mono text-cyan-400 tracking-widest mb-8">
                    ENTER COMPILED COORDINATES
                  </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs text-white/60 font-mono uppercase tracking-widest">Latitude</label>
                      <input
                      type="text"
                      value={trackerLat}
                      onChange={(e) => setTrackerLat(e.target.value)}
                      placeholder={trackerLocked ? `LOCKED: ${cooldown}s` : "XX.XXXX"}
                      disabled={trackerLocked}
                      className={`w-full bg-black/60 border ${trackerLocked ? 'border-yellow-900/50' : 'border-cyan-900'} focus:border-cyan-400 px-4 py-3 rounded text-cyan-300 font-mono transition-all outline-none uppercase ${trackerLocked ? 'opacity-50' : ''}`}
                    />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-white/60 font-mono uppercase tracking-widest">Longitude</label>
                      <input
                        type="text"
                        value={trackerLon}
                        onChange={(e) => setTrackerLon(e.target.value)}
                        placeholder={trackerLocked ? `LOCKED: ${cooldown}s` : "XX.XXXX"}
                        disabled={trackerLocked}
                        className={`w-full bg-black/60 border ${trackerLocked ? 'border-yellow-900/50' : 'border-cyan-900'} focus:border-cyan-400 px-4 py-3 rounded text-cyan-300 font-mono transition-all outline-none ${trackerLocked ? 'opacity-50' : ''}`}
                      />
                    </div>

                    {trackerError && <div className="text-center text-xs font-mono text-red-500 tracking-widest">{trackerError}</div>}

                    <button
                      disabled={isVerifyingGeo || cooldown > 0}
                      className="w-full py-4 text-xs font-mono font-bold tracking-[0.2em] bg-cyan-900/40 text-cyan-300 border border-cyan-600 rounded hover:bg-cyan-800/60 transition-all uppercase disabled:opacity-50"
                    >
                      {isVerifyingGeo ? 'VERIFYING SATELLITE LINK...' : cooldown > 0 ? `LOCKED: ${cooldown}s` : 'INITIATE SATELLITE SCAN'}
                    </button>
                  </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 min-h-0 animate-fade-in">
          <div className="flex-1 border border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.2)]">
            <MapContainer center={[mapLocation.lat, mapLocation.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[mapLocation.lat, mapLocation.lng]} icon={createCustomIcon('#22d3ee')}>
                <Popup>
                  <div className="text-center font-mono text-xs">
                    <p className="font-bold text-cyan-400">BREACH SUCESSFUL</p>
                    <p>{mapLocation.locationName}</p>
                    <p className="text-white/80">{mapLocation.lat}, {mapLocation.lng}</p>
                  </div>
                </Popup>
              </Marker>
              <MapUpdater lat={mapLocation.lat} lng={mapLocation.lng} />
            </MapContainer>
          </div>

          <div className="premium-glass-card border border-cyan-500/30 bg-black/80 p-6 rounded-lg text-center space-y-6">
            <div>
              <h2 className="premium-heading text-2xl text-cyan-300">LOCATION BREACHED SUCCESSFULLY</h2>
              <p className="text-sm text-green-400 mt-2 font-mono">THE TROPHY IS AT THIS LOCATION</p>
              <p className="text-xs text-white/60 font-mono mt-1">{mapLocation.locationName}</p>
            </div>
            
            <button
              onClick={onComplete}
              className="premium-button bg-cyan-900/60 border border-cyan-400 hover:border-cyan-300 text-cyan-100 hover:text-white hover:bg-cyan-800 focus:ring-cyan-500 w-full py-4 text-sm font-bold tracking-[0.2em] rounded-md transition-all shadow-[0_0_15px_rgba(6,182,212,0.5)] max-w-sm mx-auto shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
            >
              ENTER THE FINAL ROUND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
