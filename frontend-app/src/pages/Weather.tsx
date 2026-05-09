import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CloudRain, Sun, CloudDrizzle, Cloud, Thermometer,
  Wind, Droplets, Eye, Umbrella,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TRACKS } from "@/data/mockData";

// ── Historical rain profiles per track (from tracks.py rain_probability)
// Key = display name fragment, value = { month, rainProb, avgAirTemp, description, wetRaces5yr }
const TRACK_WEATHER: Record<string, {
  key: string;
  raceMonth: number;
  rainProb: number;        // 0-1, race-day probability
  avgAirTemp: number;      // °C at race time
  avgTrackTemp: number;
  avgWindKph: number;
  humidity: number;
  description: string;
  wetRaces5yr: number;
  scProb: number;
}> = {
  "Bahrain Grand Prix":         { key: "Bahrain",     raceMonth: 3,  rainProb: 0.01, avgAirTemp: 26, avgTrackTemp: 34, avgWindKph: 18, humidity: 42, description: "Desert climate. Extremely rare rain. Sandy crosswinds common.", wetRaces5yr: 0, scProb: 0.35 },
  "Saudi Arabian Grand Prix":   { key: "Jeddah",      raceMonth: 3,  rainProb: 0.05, avgAirTemp: 28, avgTrackTemp: 38, avgWindKph: 12, humidity: 55, description: "Hot & humid coastal night race. Sporadic short-lived showers possible.", wetRaces5yr: 0, scProb: 0.55 },
  "Australian Grand Prix":      { key: "Melbourne",   raceMonth: 3,  rainProb: 0.18, avgAirTemp: 21, avgTrackTemp: 28, avgWindKph: 22, humidity: 68, description: "Melbourne March weather is notoriously unpredictable. Mixed conditions frequent.", wetRaces5yr: 2, scProb: 0.45 },
  "Japanese Grand Prix":        { key: "Suzuka",      raceMonth: 4,  rainProb: 0.22, avgAirTemp: 17, avgTrackTemp: 24, avgWindKph: 14, humidity: 72, description: "Spring rain is common at Suzuka. Track can be very wet. 2019, 2022 saw rain.", wetRaces5yr: 2, scProb: 0.30 },
  "Chinese Grand Prix":         { key: "Shanghai",    raceMonth: 4,  rainProb: 0.20, avgAirTemp: 19, avgTrackTemp: 27, avgWindKph: 16, humidity: 75, description: "April showers common. Track can be slippery with humid air.", wetRaces5yr: 1, scProb: 0.40 },
  "Miami Grand Prix":           { key: "Miami",       raceMonth: 5,  rainProb: 0.22, avgAirTemp: 29, avgTrackTemp: 42, avgWindKph: 18, humidity: 78, description: "Florida afternoon thunderstorms are frequent but brief. High track temp.", wetRaces5yr: 1, scProb: 0.45 },
  "Emilia Romagna Grand Prix":  { key: "Imola",       raceMonth: 5,  rainProb: 0.18, avgAirTemp: 20, avgTrackTemp: 28, avgWindKph: 12, humidity: 65, description: "Po Valley can bring Spring rainfall. 2024 saw significant rain.", wetRaces5yr: 2, scProb: 0.40 },
  "Monaco Grand Prix":          { key: "Monaco",      raceMonth: 5,  rainProb: 0.20, avgAirTemp: 22, avgTrackTemp: 32, avgWindKph: 8,  humidity: 62, description: "Historic wet Monaco races. Small track means rain = full SC almost guaranteed.", wetRaces5yr: 2, scProb: 0.60 },
  "Canadian Grand Prix":        { key: "Canada",      raceMonth: 6,  rainProb: 0.22, avgAirTemp: 24, avgTrackTemp: 34, avgWindKph: 16, humidity: 70, description: "Montreal June weather highly variable. 2011, 2016 memorable wet races.", wetRaces5yr: 2, scProb: 0.50 },
  "Spanish Grand Prix":         { key: "Spain",       raceMonth: 6,  rainProb: 0.12, avgAirTemp: 27, avgTrackTemp: 40, avgWindKph: 14, humidity: 52, description: "Barcelona typically hot and dry in June. Rain rare but possible.", wetRaces5yr: 0, scProb: 0.30 },
  "Austrian Grand Prix":        { key: "Austria",     raceMonth: 7,  rainProb: 0.28, avgAirTemp: 22, avgTrackTemp: 30, avgWindKph: 20, humidity: 68, description: "Red Bull Ring is prone to afternoon Alpine thunderstorms. 2021 had rain.", wetRaces5yr: 2, scProb: 0.35 },
  "British Grand Prix":         { key: "Silverstone", raceMonth: 7,  rainProb: 0.16, avgAirTemp: 19, avgTrackTemp: 26, avgWindKph: 25, humidity: 72, description: "Silverstone in July can be mixed. 2008 was famously wet. Windy conditions.", wetRaces5yr: 1, scProb: 0.35 },
  "Hungarian Grand Prix":       { key: "Hungary",     raceMonth: 7,  rainProb: 0.15, avgAirTemp: 28, avgTrackTemp: 42, avgWindKph: 10, humidity: 60, description: "Hungaroring is typically hot and dry. Occasional summer storms possible.", wetRaces5yr: 1, scProb: 0.35 },
  "Belgian Grand Prix":         { key: "Spa",         raceMonth: 7,  rainProb: 0.20, avgAirTemp: 17, avgTrackTemp: 23, avgWindKph: 22, humidity: 78, description: "Spa-Francorchamps: expect the unexpected. Each sector can have different weather. 2021 red-flagged.", wetRaces5yr: 3, scProb: 0.45 },
  "Dutch Grand Prix":           { key: "Zandvoort",   raceMonth: 8,  rainProb: 0.20, avgAirTemp: 20, avgTrackTemp: 28, avgWindKph: 28, humidity: 74, description: "North Sea coastal winds are strong. Late-summer showers possible. Sandy circuit.", wetRaces5yr: 1, scProb: 0.40 },
  "Italian Grand Prix":         { key: "Monza",       raceMonth: 9,  rainProb: 0.18, avgAirTemp: 24, avgTrackTemp: 33, avgWindKph: 10, humidity: 62, description: "Monza September is usually warm and dry. Occasional thunderstorms.", wetRaces5yr: 1, scProb: 0.30 },
  "Azerbaijan Grand Prix":      { key: "Baku",        raceMonth: 9,  rainProb: 0.05, avgAirTemp: 26, avgTrackTemp: 35, avgWindKph: 30, humidity: 58, description: "Baku is very dry but notoriously windy along the straights.", wetRaces5yr: 0, scProb: 0.55 },
  "Singapore Grand Prix":       { key: "Singapore",   raceMonth: 9,  rainProb: 0.32, avgAirTemp: 30, avgTrackTemp: 32, avgWindKph: 8,  humidity: 85, description: "Tropical monsoon climate. Night race. Rain before/during common. 2009, 2017 wet.", wetRaces5yr: 3, scProb: 0.50 },
  "United States Grand Prix":   { key: "COTA",        raceMonth: 10, rainProb: 0.15, avgAirTemp: 22, avgTrackTemp: 30, avgWindKph: 16, humidity: 65, description: "Austin October is warm but afternoon storms possible from Gulf moisture.", wetRaces5yr: 1, scProb: 0.35 },
  "Mexico City Grand Prix":     { key: "Mexico",      raceMonth: 10, rainProb: 0.12, avgAirTemp: 21, avgTrackTemp: 28, avgWindKph: 10, humidity: 58, description: "High altitude (2,285m) means thinner air. Afternoon thunder possible.", wetRaces5yr: 0, scProb: 0.35 },
  "Sao Paulo Grand Prix":       { key: "Brazil",      raceMonth: 11, rainProb: 0.25, avgAirTemp: 24, avgTrackTemp: 32, avgWindKph: 18, humidity: 72, description: "Interlagos November is Brazil's wet season. 2016, 2022 saw rain. Very variable.", wetRaces5yr: 3, scProb: 0.40 },
  "Las Vegas Grand Prix":       { key: "Las Vegas",   raceMonth: 11, rainProb: 0.03, avgAirTemp: 12, avgTrackTemp: 14, avgWindKph: 14, humidity: 28, description: "Cold desert night race. Very low rain probability. Temperature can be near freezing.", wetRaces5yr: 0, scProb: 0.45 },
  "Qatar Grand Prix":           { key: "Qatar",       raceMonth: 12, rainProb: 0.02, avgAirTemp: 24, avgTrackTemp: 28, avgWindKph: 16, humidity: 48, description: "Losail night race is dry and warm. Near-zero rain probability.", wetRaces5yr: 0, scProb: 0.30 },
  "Abu Dhabi Grand Prix":       { key: "Abu Dhabi",   raceMonth: 12, rainProb: 0.01, avgAirTemp: 26, avgTrackTemp: 32, avgWindKph: 12, humidity: 52, description: "Yas Marina is reliably dry and warm. Season finale in perfect conditions.", wetRaces5yr: 0, scProb: 0.30 },
};

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const conditionIcons: Record<string, typeof Sun> = {
  DRY: Sun, DRIZZLE: CloudDrizzle, LIGHT_RAIN: CloudRain, HEAVY_RAIN: CloudRain,
};

const conditionColors: Record<string, string> = {
  DRY: "#FFAA00", DRIZZLE: "#60A5FA", LIGHT_RAIN: "#3B82F6", HEAVY_RAIN: "#1D4ED8",
};

function getRainCategory(prob: number): { label: string; color: string } {
  if (prob < 0.05) return { label: "Very Unlikely", color: "#22C55E" };
  if (prob < 0.15) return { label: "Low Chance", color: "#84CC16" };
  if (prob < 0.25) return { label: "Moderate", color: "#EAB308" };
  if (prob < 0.40) return { label: "Likely", color: "#F97316" };
  return { label: "High Risk", color: "#EF4444" };
}

/** Generate a per-lap forecast based on track's rain probability using Markov-like transitions */
function generateForecast(rainProb: number, airTemp: number, laps: number) {
  const out = [];
  let curProb = rainProb * 0.7; // start drier than historical average
  let curTemp = airTemp;
  for (let i = 5; i <= laps; i += 2) {
    // Random walk with mean-reversion to historical prob
    const drift = (rainProb - curProb) * 0.08;
    curProb = Math.max(0, Math.min(1, curProb + drift + (Math.random() - 0.5) * 0.04));
    curTemp = curTemp + (Math.random() - 0.5) * 0.3;
    const condition = curProb > 0.6 ? "HEAVY_RAIN"
      : curProb > 0.35 ? "LIGHT_RAIN"
      : curProb > 0.15 ? "DRIZZLE"
      : "DRY";
    out.push({ lap: i, condition, rainProbability: curProb, airTemp: Math.round(curTemp * 10) / 10 });
  }
  return out;
}

export default function WeatherCenter() {
  const [selectedTrack, setSelectedTrack] = useState(TRACKS[13].name);

  const profile = TRACK_WEATHER[selectedTrack];
  const displayName = selectedTrack.replace(" Grand Prix", "");

  const forecast = useMemo(
    () => profile ? generateForecast(profile.rainProb, profile.avgAirTemp, 60) : [],
    [selectedTrack, profile?.rainProb, profile?.avgAirTemp],
  );

  const rainCat = profile ? getRainCategory(profile.rainProb) : { label: "Unknown", color: "#888" };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">Weather Center</h1>
        <p className="text-text-secondary text-sm">Historical patterns, race-day forecasts & tire crossover guidance</p>
      </div>

      {/* Track Selector */}
      <div className="bg-surface rounded-lg border border-border-subtle p-4">
        <label className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-3 block">
          Select Track
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {TRACKS.map((t) => {
            const tp = TRACK_WEATHER[t.name];
            const rc = tp ? getRainCategory(tp.rainProb) : null;
            return (
              <button key={t.name} onClick={() => setSelectedTrack(t.name)}
                className={`px-3 py-2 rounded-md text-xs font-semibold transition-all text-left relative ${
                  selectedTrack === t.name
                    ? "bg-rosso/10 text-rosso border border-rosso/30"
                    : "bg-carbon text-text-secondary border border-border-subtle hover:text-text-primary hover:border-text-ghost/30"
                }`}
              >
                <div className="truncate">{t.name.replace(" Grand Prix", "")}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-text-ghost font-normal">{t.laps} laps</span>
                  {rc && (
                    <span className="text-[9px] font-mono font-bold" style={{ color: rc.color }}>
                      {((tp?.rainProb ?? 0) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {profile ? (
        <>
          {/* Current Conditions + Historical Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Main Condition Card */}
            <motion.div key={selectedTrack}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-surface rounded-lg border border-border-subtle p-5 md:col-span-1"
            >
              <div className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-4">
                Race Conditions — {displayName} ({MONTH_NAMES[profile.raceMonth]})
              </div>
              <div className="flex items-center gap-5 mb-4">
                {profile.rainProb > 0.2
                  ? <CloudRain className="w-16 h-16 text-weather-blue" />
                  : profile.rainProb > 0.08
                  ? <CloudDrizzle className="w-16 h-16 text-blue-400" />
                  : <Sun className="w-16 h-16 text-warning-amber" />}
                <div>
                  <p className="text-3xl font-black text-text-primary">{profile.avgAirTemp}°C</p>
                  <p className="text-sm text-text-secondary">Track: {profile.avgTrackTemp}°C</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: rainCat.color }}>
                    {rainCat.label}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Wind className="w-3.5 h-3.5 text-text-ghost" />
                  <span className="text-xs text-text-secondary">{profile.avgWindKph} km/h</span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-3.5 h-3.5 text-text-ghost" />
                  <span className="text-xs text-text-secondary">{profile.humidity}% humidity</span>
                </div>
                <div className="flex items-center gap-2">
                  <CloudRain className="w-3.5 h-3.5 text-weather-blue" />
                  <span className="text-xs text-text-secondary">{(profile.rainProb * 100).toFixed(0)}% rain prob</span>
                </div>
                <div className="flex items-center gap-2">
                  <Umbrella className="w-3.5 h-3.5 text-ferrari-gold" />
                  <span className="text-xs text-text-secondary">SC prob {(profile.scProb * 100).toFixed(0)}%</span>
                </div>
              </div>

              <p className="text-[11px] text-text-ghost leading-relaxed italic">
                "{profile.description}"
              </p>
            </motion.div>

            {/* Forecast Mini Cards */}
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {forecast.slice(0, 8).map((fc, i) => {
                const Icon = conditionIcons[fc.condition] ?? Cloud;
                const color = conditionColors[fc.condition] ?? "#8B8BA0";
                return (
                  <motion.div key={fc.lap}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-surface rounded-lg border border-border-subtle p-3 text-center"
                  >
                    <p className="text-[10px] text-text-ghost font-mono mb-2">Lap {fc.lap}</p>
                    <Icon className="w-6 h-6 mx-auto mb-2" style={{ color }} />
                    <p className="text-xs font-bold" style={{ color }}>{fc.condition.replace("_", " ")}</p>
                    <p className="text-xs text-text-secondary mt-1">{fc.airTemp.toFixed(0)}°C</p>
                    <p className="text-[10px] text-text-ghost mt-0.5">
                      Rain: {(fc.rainProbability * 100).toFixed(0)}%
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Historical stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Race-Day Rain Prob", value: `${(profile.rainProb * 100).toFixed(0)}%`, Icon: CloudRain, color: rainCat.color },
              { label: "Avg Air Temp", value: `${profile.avgAirTemp}°C`, Icon: Thermometer, color: "#FFAA00" },
              { label: "Wet Races (5yr)", value: String(profile.wetRaces5yr), Icon: Umbrella, color: "#3B82F6" },
              { label: "Safety Car Prob", value: `${(profile.scProb * 100).toFixed(0)}%`, Icon: Eye, color: "#7B61FF" },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface rounded-lg border border-border-subtle p-3">
                <div className="flex items-center gap-2 mb-1">
                  <stat.Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">{stat.label}</span>
                </div>
                <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Tire crossover guide */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-4">
              <Droplets className="w-4 h-4 text-neural-cyan" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Tire Crossover Guidance</h3>
              <span className="text-xs text-text-ghost ml-2">— {displayName}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { compound: "SLICK",        range: "< 8% damp",  color: "#F5F5F5", bg: "#F5F5F520", desc: "Standard dry compounds. No track dampness." },
                { compound: "INTERMEDIATE", range: "20–55% damp", color: "#00D084", bg: "#00D08420", desc: "Light rain, drying surface, or damp patches." },
                { compound: "WET",          range: "> 65% damp",  color: "#1E90FF", bg: "#1E90FF20", desc: "Heavy rain, standing water, visibility reduced." },
              ].map((t) => (
                <div key={t.compound} className="rounded-lg border p-3 text-center"
                  style={{ borderColor: t.color + "33", backgroundColor: t.bg }}>
                  <div className="w-6 h-6 rounded-full mx-auto mb-2" style={{ backgroundColor: t.color }} />
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: t.color }}>{t.compound}</p>
                  <p className="text-[10px] font-mono text-text-ghost mt-1">{t.range}</p>
                  <p className="text-[10px] text-text-secondary mt-2 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rain Probability Chart */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-4">
              <CloudRain className="w-4 h-4 text-weather-blue" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Rain Probability Forecast — {displayName}
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
                <XAxis dataKey="lap" stroke="#55556B" fontSize={11} tickLine={false}
                  label={{ value: "Lap", position: "insideBottom", offset: -5, fill: "#55556B", fontSize: 11 }} />
                <YAxis yAxisId="prob" domain={[0, 1]} stroke="#55556B" fontSize={11} tickLine={false}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  label={{ value: "Rain %", angle: -90, position: "insideLeft", fill: "#55556B", fontSize: 11 }} />
                <YAxis yAxisId="temp" orientation="right" domain={["auto", "auto"]} stroke="#55556B"
                  fontSize={11} tickLine={false} tickFormatter={(v: number) => `${v}°C`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16161E", border: "1px solid #2D2D3D", borderRadius: 8, color: "#F0F0F5", fontSize: 12 }}
                  formatter={(v: number, name: string) => name === "airTemp" ? [`${v.toFixed(1)}°C`, "Air Temp"] : [`${(v * 100).toFixed(0)}%`, "Rain Prob"]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8B8BA8" }} />
                <Bar yAxisId="prob" dataKey="rainProbability" name="Rain Probability" fill="#3B82F6" opacity={0.7} radius={[2, 2, 0, 0]} />
                <Line yAxisId="temp" dataKey="airTemp" name="Air Temp" stroke="#FFAA00" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="text-center text-text-ghost py-12">Select a track above to view weather data</div>
      )}
    </div>
  );
}
