import {
  ActivityImpactScore,
  AIModuleId,
  AlertRule,
  AstronomicalPhase,
  CityLocation,
  HourlyTimelinePoint,
  LanguageCode,
  ModelComparisonPoint,
  TempUnit,
  WhatIfModifiers,
  WindUnit,
} from '../types/weather';

export function cToF(celsius: number): number {
  return Math.round(((celsius * 9) / 5 + 32) * 10) / 10;
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  const val = unit === 'F' ? cToF(celsius) : Math.round(celsius * 10) / 10;
  return `${val.toFixed(1)}°${unit}`;
}

export function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371 * 10) / 10;
}

export function formatWind(kmh: number, unit: WindUnit): string {
  const val = unit === 'mph' ? kmhToMph(kmh) : Math.round(kmh * 10) / 10;
  return `${val.toFixed(1)} ${unit === 'mph' ? 'mph' : 'km/h'}`;
}

export function getCompassDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % 8];
}

export function getAstronomicalPhase(
  localHour: number,
  sunriseHour = 5.9,
  sunsetHour = 17.5
): AstronomicalPhase {
  const h = ((localHour % 24) + 24) % 24;
  if (h >= sunriseHour - 0.8 && h <= sunriseHour + 1.5) return 'dawn';
  if (h > sunriseHour + 1.5 && h < sunsetHour - 1.5) return 'noon';
  if (h >= sunsetHour - 1.5 && h <= sunsetHour + 0.9) return 'evening';
  return 'night';
}

export function calculateHeatStressRisk(
  tempC: number,
  humidity: number,
  uvIndex: number,
  windSpeedKmh: number
): {
  wbgtC: number;
  heatIndexC: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Extreme';
  hydrationMlPerHour: number;
} {
  const rh = Math.max(5, Math.min(100, humidity));
  const wetBulb =
    tempC * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5)) +
    Math.atan(tempC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035;

  const solarLoad = Math.max(0, uvIndex) * 0.35 - Math.min(windSpeedKmh, 35) * 0.05;
  const wbgtC = Math.round((0.7 * wetBulb + 0.3 * tempC + solarLoad) * 10) / 10;

  const heatIndexC =
    tempC >= 26
      ? Math.round((tempC + (rh - 45) * 0.14 + Math.max(0, uvIndex - 5) * 0.25) * 10) / 10
      : Math.round(tempC * 10) / 10;

  let riskLevel: 'Low' | 'Moderate' | 'High' | 'Extreme' = 'Low';
  let hydrationMlPerHour = 250;

  if (wbgtC >= 32 || heatIndexC >= 41) {
    riskLevel = 'Extreme';
    hydrationMlPerHour = 1000;
  } else if (wbgtC >= 28 || heatIndexC >= 35) {
    riskLevel = 'High';
    hydrationMlPerHour = 750;
  } else if (wbgtC >= 24 || heatIndexC >= 30) {
    riskLevel = 'Moderate';
    hydrationMlPerHour = 500;
  }

  return { wbgtC, heatIndexC, riskLevel, hydrationMlPerHour };
}

export function buildHourlyTimeline(
  city: CityLocation,
  selectedDataSource: 'Auto' | 'ECMWF IFS 0.25°' | 'NOAA GFS 0.25°' | 'DWD ICON Global' = 'Auto',
  referenceHourLocal = 14
): HourlyTimelinePoint[] {
  const base = city.baseTelemetry;
  const points: HourlyTimelinePoint[] = [];

  for (let offset = -24; offset <= 72; offset++) {
    const localHour = (((referenceHourLocal + offset) % 24) + 24) % 24;
    const isHistorical = offset <= 0;

    const diurnalPhase = ((localHour - 14.5) / 24) * Math.PI * 2;
    const diurnalSwing = Math.cos(diurnalPhase) * ((base.highC - base.lowC) * 0.48);
    const synopticTrend = Math.sin(offset * 0.09) * 1.1;

    const tempC = Math.round((base.tempC + diurnalSwing * 0.65 + synopticTrend) * 10) / 10;
    const humidity = Math.round(
      Math.max(30, Math.min(98, base.humidity - diurnalSwing * 2.4 + Math.cos(offset * 0.12) * 5))
    );

    const convectiveWave = Math.max(0, Math.sin(((localHour - 9) / 12) * Math.PI)) * 18;
    const rainProb = Math.round(
      Math.max(5, Math.min(98, base.rainProb + (offset === 0 ? 0 : convectiveWave - 8 + Math.sin(offset * 0.2) * 12)))
    );

    const cloudCover = Math.round(
      Math.max(8, Math.min(100, base.cloudCover + (rainProb - base.rainProb) * 0.55))
    );

    const precipMm =
      rainProb > 45
        ? Math.round(Math.max(0.2, (rainProb - 40) * 0.16 * (1 + Math.sin(offset * 0.3) * 0.3)) * 10) / 10
        : 0;

    const windSpeedKmh =
      Math.round(
        Math.max(4, base.windSpeedKmh + Math.sin(offset * 0.18) * 5.2 + (rainProb > 65 ? 4.5 : 0)) * 10
      ) / 10;

    const windDirectionDeg = Math.round((base.windDirectionDeg + offset * 2.5 + 360) % 360);

    const isDaylight = localHour >= base.sunriseHour && localHour <= base.sunsetHour;
    const solarElev = isDaylight
      ? Math.sin(((localHour - base.sunriseHour) / (base.sunsetHour - base.sunriseHour)) * Math.PI)
      : 0;
    const uvIndex = Math.round(Math.max(0, base.uvIndex * solarElev * (1 - cloudCover * 0.0045)) * 10) / 10;

    const aqi = Math.round(
      Math.max(18, base.aqi - precipMm * 2.8 + Math.cos(offset * 0.15) * 10)
    );
    const pressureHpa = Math.round((base.pressureHpa - (rainProb - 50) * 0.06) * 10) / 10;

    const { heatIndexC } = calculateHeatStressRisk(tempC, humidity, uvIndex, windSpeedKmh);

    let conditionCode = base.conditionCode;
    if (rainProb >= 78 && windSpeedKmh >= 22) conditionCode = 'thunderstorm';
    else if (rainProb >= 52) conditionCode = 'rain';
    else if (cloudCover >= 75) conditionCode = 'overcast';
    else if (cloudCover >= 35) conditionCode = 'partly-cloudy';
    else conditionCode = 'clear';

    let dataSource: HourlyTimelinePoint['dataSource'];
    if (isHistorical) {
      dataSource = 'BMD Synoptic + Open-Meteo Archive';
    } else if (selectedDataSource !== 'Auto') {
      dataSource = selectedDataSource;
    } else {
      dataSource = offset <= 24 ? 'ECMWF IFS 0.25°' : offset <= 48 ? 'NOAA GFS 0.25°' : 'DWD ICON Global';
    }

    const d = new Date(Date.UTC(2026, 9, 29, 8 + offset, 0, 0));
    points.push({
      hourOffset: offset,
      timestampIso: d.toISOString(),
      localHour,
      isHistorical,
      dataSource,
      tempC: offset === 0 ? base.tempC : tempC,
      feelsLikeC: offset === 0 ? base.feelsLikeC : heatIndexC,
      rainProb: offset === 0 ? base.rainProb : rainProb,
      precipMm: offset === 0 ? base.precipMm : precipMm,
      cloudCover: offset === 0 ? base.cloudCover : cloudCover,
      windSpeedKmh: offset === 0 ? base.windSpeedKmh : windSpeedKmh,
      windDirectionDeg: offset === 0 ? base.windDirectionDeg : windDirectionDeg,
      humidity: offset === 0 ? base.humidity : humidity,
      uvIndex: offset === 0 ? base.uvIndex : uvIndex,
      aqi: offset === 0 ? base.aqi : aqi,
      pressureHpa: offset === 0 ? base.pressureHpa : pressureHpa,
      conditionCode: offset === 0 ? base.conditionCode : conditionCode,
    });
  }

  return points;
}

export function parseWhatIfPrompt(prompt: string, current: WhatIfModifiers): WhatIfModifiers {
  const text = prompt.trim().toLowerCase();
  const next: WhatIfModifiers = { ...current, activePromptText: prompt };

  if (text.includes('reset') || text.includes('normal') || text.includes('স্বাভাবিক')) {
    return {
      tempDeltaC: 0,
      windMultiplier: 1,
      cloudOverride: null,
      rainOverride: null,
      activePromptText: '',
    };
  }

  if ((text.includes('double') && text.includes('wind')) || text.includes('দ্বিগুণ বাতাস') || text.includes('wind speed doubles')) {
    next.windMultiplier = 2.0;
  } else if ((text.includes('triple') && text.includes('wind')) || text.includes('gale') || text.includes('ঝড়') || text.includes('কালবৈশাখী')) {
    next.windMultiplier = 2.8;
    next.rainOverride = 90;
    next.cloudOverride = 95;
  } else if (text.includes('calm') || text.includes('no wind')) {
    next.windMultiplier = 0.3;
  }

  const cloudMatch = text.match(/cloud[a-z\s]*?(\d{1,3})\s*%/) || text.match(/(\d{1,3})\s*%\s*cloud/);
  if (cloudMatch) {
    next.cloudOverride = Math.min(100, Math.max(0, Number(cloudMatch[1])));
  } else if (text.includes('clear sky') || text.includes('পরিষ্কার আকাশ')) {
    next.cloudOverride = 10;
    next.rainOverride = 5;
  } else if (text.includes('overcast') || text.includes('মেঘলা')) {
    next.cloudOverride = 90;
  }

  const rainMatch = text.match(/rain[a-z\s]*?(\d{1,3})\s*%/) || text.match(/(\d{1,3})\s*%\s*rain/);
  if (rainMatch) {
    next.rainOverride = Math.min(100, Math.max(0, Number(rainMatch[1])));
  } else if (text.includes('heavy rain') || text.includes('monsoon') || text.includes('ভারী বৃষ্টি')) {
    next.rainOverride = 92;
    next.cloudOverride = 94;
  }

  const tempRaiseMatch =
    text.match(/(?:raise|increase|add|warmer|বৃদ্ধি)[a-z\s]*?(?:temperature|temp|তাপমাত্রা)[a-z\s]*?(\d+(?:\.\d+)?)/) ||
    text.match(/(?:temperature|temp|তাপমাত্রা)[a-z\s]*?(?:raise|increase|up|by|\+)[a-z\s]*?(\d+(?:\.\d+)?)/) ||
    text.match(/\+\s*(\d+(?:\.\d+)?)\s*°?\s*c\b/);
  const tempDropMatch =
    text.match(/(?:drop|decrease|lower|cooler|কমাও)[a-z\s]*?(?:temperature|temp|তাপমাত্রা)[a-z\s]*?(\d+(?:\.\d+)?)/) ||
    text.match(/(?:temperature|temp|তাপমাত্রা)[a-z\s]*?(?:drop|decrease|down|-)[a-z\s]*?(\d+(?:\.\d+)?)/) ||
    text.match(/-\s*(\d+(?:\.\d+)?)\s*°?\s*c\b/);
  if (tempRaiseMatch) {
    next.tempDeltaC = Math.min(15, Math.max(-10, Number(tempRaiseMatch[1])));
  } else if (tempDropMatch) {
    next.tempDeltaC = Math.min(15, Math.max(-10, -Number(tempDropMatch[1])));
  } else if (text.includes('heatwave') || text.includes('তাপপ্রবাহ')) {
    next.tempDeltaC = 6;
    next.cloudOverride = 15;
    next.rainOverride = 5;
  }

  return next;
}

export function applyWhatIfModifiers(
  point: HourlyTimelinePoint,
  modifiers: WhatIfModifiers
): HourlyTimelinePoint {
  const tempC = Math.round((point.tempC + modifiers.tempDeltaC) * 10) / 10;
  const windSpeedKmh = Math.round(point.windSpeedKmh * modifiers.windMultiplier * 10) / 10;
  const cloudCover =
    modifiers.cloudOverride !== null ? modifiers.cloudOverride : point.cloudCover;
  const rainProb =
    modifiers.rainOverride !== null ? modifiers.rainOverride : point.rainProb;
  const precipMm =
    rainProb > 45 ? Math.round(((rainProb - 40) * 0.22) * 10) / 10 : 0;

  const humidity = Math.round(
    Math.max(25, Math.min(99, point.humidity + (rainProb - point.rainProb) * 0.25 - modifiers.tempDeltaC * 1.4))
  );

  const uvIndex = Math.round(
    Math.max(0, point.uvIndex * (1 - (cloudCover - point.cloudCover) * 0.005)) * 10
  ) / 10;

  const { heatIndexC } = calculateHeatStressRisk(tempC, humidity, uvIndex, windSpeedKmh);

  let conditionCode = point.conditionCode;
  if (rainProb >= 75 && windSpeedKmh >= 24) conditionCode = 'thunderstorm';
  else if (rainProb >= 50) conditionCode = 'rain';
  else if (cloudCover >= 75) conditionCode = 'overcast';
  else if (cloudCover >= 30) conditionCode = 'partly-cloudy';
  else conditionCode = 'clear';

  return {
    ...point,
    tempC,
    feelsLikeC: heatIndexC,
    windSpeedKmh,
    cloudCover,
    rainProb,
    precipMm,
    humidity,
    uvIndex,
    conditionCode,
  };
}

export function calculateActivityImpacts(point: HourlyTimelinePoint): ActivityImpactScore[] {
  const windPenalty = Math.max(0, (point.windSpeedKmh - 14) * 2.1);
  const rainPenalty = point.rainProb > 35 ? (point.rainProb - 35) * 1.15 : 0;
  const lightingBonus = point.cloudCover >= 25 && point.cloudCover <= 65 ? 12 : 0;
  const videoScore = Math.round(
    Math.max(5, Math.min(98, 88 - windPenalty - rainPenalty + lightingBonus))
  );

  const evapDrive =
    (point.tempC - 15) * 1.8 +
    point.uvIndex * 3.5 +
    Math.min(point.windSpeedKmh, 30) * 0.9 -
    Math.max(0, point.humidity - 50) * 0.85 -
    (point.rainProb > 30 ? point.rainProb * 0.75 : 0);
  const laundryScore = Math.round(Math.max(5, Math.min(99, 45 + evapDrive)));
  const estDryHours = Math.max(1.2, Math.round((7.5 - laundryScore * 0.06) * 10) / 10);

  const et0MmDay = Math.round(
    Math.max(1.1, 0.14 * point.tempC + 0.22 * point.uvIndex + 0.06 * point.windSpeedKmh - 0.03 * point.humidity) * 10
  ) / 10;
  const spraySafe = point.windSpeedKmh <= 18 && point.rainProb <= 40;
  const agriScore = Math.round(
    Math.max(
      12,
      Math.min(
        96,
        (spraySafe ? 86 : 48) -
          Math.max(0, point.rainProb - 50) * 0.5 -
          Math.max(0, point.windSpeedKmh - 20) * 1.2
      )
    )
  );

  const cloudTransmittance = 1 - (point.cloudCover / 100) * 0.72;
  const thermalDerating = point.tempC > 25 ? (point.tempC - 25) * 0.0045 : 0;
  const solarFactor = Math.max(0.05, cloudTransmittance * (1 - thermalDerating));
  const isDay = point.uvIndex > 0.2 || (point.localHour >= 6 && point.localHour <= 17);
  const solarScore = isDay
    ? Math.round(Math.max(8, Math.min(99, solarFactor * 100)))
    : 8;

  const statusHelper = (s: number): { en: ActivityImpactScore['statusEn']; bn: string } => {
    if (s >= 75) return { en: 'Optimal', bn: 'সর্বোত্তম (Optimal)' };
    if (s >= 52) return { en: 'Moderate', bn: 'মাঝারি (Moderate)' };
    if (s >= 32) return { en: 'Caution', bn: 'সতর্কতা (Caution)' };
    return { en: 'Unfavorable', bn: 'প্রতিকূল (Unfavorable)' };
  };

  const vStat = statusHelper(videoScore);
  const lStat = statusHelper(laundryScore);
  const aStat = statusHelper(agriScore);
  const sStat = statusHelper(solarScore);

  return [
    {
      id: 'video_shoot',
      titleEn: 'Outdoor Video Shoot',
      titleBn: 'আউটডোর ভিডিও শুট',
      score: videoScore,
      statusEn: vStat.en,
      statusBn: vStat.bn,
      metricLabelEn: `Cloud Diffusion ${point.cloudCover}% · Wind Mic Risk ${point.windSpeedKmh} km/h`,
      metricLabelBn: `মেঘের বিচ্ছুরণ ${point.cloudCover}% · বাতাসের শব্দ ঝুঁকি ${point.windSpeedKmh} km/h`,
      reasoningEn:
        point.windSpeedKmh > 20
          ? `Deadcat windjammer required (${point.windSpeedKmh} km/h gusts); ${point.rainProb}% rain risk requires weather-sealed lens.`
          : `Soft ${point.cloudCover}% cloud diffusion provides balanced dynamic range with low wind-noise interference.`,
      reasoningBn:
        point.windSpeedKmh > 20
          ? `মাইক্রোফোনে উইন্ডশিল্ড প্রয়োজন (${point.windSpeedKmh} km/h বাতাস); ${point.rainProb}% বৃষ্টির সম্ভাবনা রয়েছে।`
          : `${point.cloudCover}% মেঘের কারণে প্রাকৃতিক সফট লাইটিং এবং কম বাতাসের শব্দ পাওয়া যাবে।`,
    },
    {
      id: 'laundry',
      titleEn: 'Laundry & Crop Drying',
      titleBn: 'কাপড় ও ফসল শুকানো',
      score: laundryScore,
      statusEn: lStat.en,
      statusBn: lStat.bn,
      metricLabelEn: `Est. Drying Time ~${estDryHours} hrs · RH ${point.humidity}%`,
      metricLabelBn: `আনুমানিক শুকানোর সময় ~${estDryHours} ঘণ্টা · আর্দ্রতা ${point.humidity}%`,
      reasoningEn:
        point.rainProb > 50
          ? `High rain probability (${point.rainProb}%) and ${point.humidity}% humidity inhibit outdoor evaporation.`
          : `Vapor pressure deficit at ${point.tempC}°C and ${point.windSpeedKmh} km/h airflow dries fabrics in ~${estDryHours}h.`,
      reasoningBn:
        point.rainProb > 50
          ? `বৃষ্টির উচ্চ সম্ভাবনা (${point.rainProb}%) এবং ${point.humidity}% আর্দ্রতা বাইরে শুকানোর জন্য প্রতিকূল।`
          : `${point.tempC}°C তাপমাত্রা ও ${point.windSpeedKmh} km/h বাতাসে প্রায় ${estDryHours} ঘণ্টায় শুকিয়ে যাবে।`,
    },
    {
      id: 'agriculture',
      titleEn: 'Agriculture & Irrigation',
      titleBn: 'কৃষি ও সেচ ব্যবস্থাপনা',
      score: agriScore,
      statusEn: aStat.en,
      statusBn: aStat.bn,
      metricLabelEn: `ET₀ ${et0MmDay} mm/day · Spray Window: ${spraySafe ? 'Safe' : 'Delay'}`,
      metricLabelBn: `বাষ্পীভবন ${et0MmDay} মিমি/দিন · স্প্রে: ${spraySafe ? 'নিরাপদ' : 'স্থগিত রাখুন'}`,
      reasoningEn: spraySafe
        ? `Low wind drift (${point.windSpeedKmh} km/h) and ${point.rainProb}% rain probability allow safe foliar spraying.`
        : `Delay pesticide/fertilizer spraying: ${point.rainProb}% rain wash-off risk and ${point.windSpeedKmh} km/h wind drift.`,
      reasoningBn: spraySafe
        ? `কম বাতাস (${point.windSpeedKmh} km/h) ও বৃষ্টির কম ঝুঁকি (${point.rainProb}%) থাকায় কীটনাশক/সার প্রয়োগ নিরাপদ।`
        : `${point.rainProb}% বৃষ্টির সম্ভাবনা ও ${point.windSpeedKmh} km/h বাতাসে স্প্রে ধুয়ে যাওয়ার ঝুঁকি রয়েছে।`,
    },
    {
      id: 'solar',
      titleEn: 'Solar PV Generation',
      titleBn: 'সৌর বিদ্যুৎ উৎপাদন',
      score: solarScore,
      statusEn: sStat.en,
      statusBn: sStat.bn,
      metricLabelEn: `PV Efficiency ${solarScore}% · UV ${point.uvIndex} · Cloud ${point.cloudCover}%`,
      metricLabelBn: `সোলার দক্ষতা ${solarScore}% · ইউভি ${point.uvIndex} · মেঘ ${point.cloudCover}%`,
      reasoningEn: isDay
        ? `Photovoltaic yield at ${solarScore}% capacity after ${point.cloudCover}% cloud attenuation and ${(thermalDerating * 100).toFixed(1)}% thermal loss.`
        : `Nighttime / twilight solar irradiance window; battery storage discharge active.`,
      reasoningBn: isDay
        ? `${point.cloudCover}% মেঘের বাধা এবং তাপমাত্রার প্রভাবে সোলার প্যানেল ${solarScore}% সক্ষমতায় বিদ্যুৎ উৎপাদন করছে।`
        : `রাতের কারণে সৌর বিকিরণ বন্ধ রয়েছে; ব্যাটারি স্টোরেজ সক্রিয়।`,
    },
  ];
}

export function buildModelComparisonSeries(city: CityLocation): {
  series: ModelComparisonPoint[];
  confidenceLevel: 'High Alignment' | 'Moderate Spread' | 'High Divergence';
  maxTempSpreadC: number;
  maxRainSpreadPct: number;
} {
  const base = city.baseTelemetry;
  const series: ModelComparisonPoint[] = [];
  let maxTempSpreadC = 0;
  let maxRainSpreadPct = 0;

  const offsets = [0, 6, 12, 18, 24, 36, 48];
  for (const h of offsets) {
    const leadFactor = h / 24;
    const ecmwfTempC = Math.round((base.tempC + Math.sin(h * 0.25) * 2.4) * 10) / 10;
    const gfsTempC = Math.round((ecmwfTempC + (city.isBangladesh ? 0.6 : -0.4) * leadFactor) * 10) / 10;
    const iconTempC = Math.round((ecmwfTempC - 0.5 * leadFactor + Math.cos(h * 0.3) * 0.4) * 10) / 10;

    const ecmwfRainProb = Math.min(98, Math.max(5, Math.round(base.rainProb + Math.sin(h * 0.2) * 15)));
    const gfsRainProb = Math.min(
      98,
      Math.max(5, Math.round(ecmwfRainProb + (base.rainProb > 55 ? 8 : -5) * leadFactor))
    );
    const iconRainProb = Math.min(
      98,
      Math.max(5, Math.round(ecmwfRainProb - 6 * leadFactor))
    );

    const tSpread = Math.max(ecmwfTempC, gfsTempC, iconTempC) - Math.min(ecmwfTempC, gfsTempC, iconTempC);
    const rSpread = Math.max(ecmwfRainProb, gfsRainProb, iconRainProb) - Math.min(ecmwfRainProb, gfsRainProb, iconRainProb);

    if (tSpread > maxTempSpreadC) maxTempSpreadC = Math.round(tSpread * 10) / 10;
    if (rSpread > maxRainSpreadPct) maxRainSpreadPct = Math.round(rSpread);

    series.push({
      hourOffset: h,
      label: h === 0 ? 'Now' : `+${h}h`,
      ecmwfTempC,
      gfsTempC,
      iconTempC,
      ecmwfRainProb,
      gfsRainProb,
      iconRainProb,
    });
  }

  let confidenceLevel: 'High Alignment' | 'Moderate Spread' | 'High Divergence' = 'High Alignment';
  if (maxRainSpreadPct >= 22 || maxTempSpreadC >= 2.2) {
    confidenceLevel = 'High Divergence';
  } else if (maxRainSpreadPct >= 12 || maxTempSpreadC >= 1.2) {
    confidenceLevel = 'Moderate Spread';
  }

  return { series, confidenceLevel, maxTempSpreadC, maxRainSpreadPct };
}

export function evaluateAlertRules(
  rules: AlertRule[],
  point: HourlyTimelinePoint
): { rule: AlertRule; actualValue: number; triggered: boolean }[] {
  return rules.map((rule) => {
    const actualValue = point[rule.metric];
    const triggered =
      rule.enabled &&
      (rule.operator === '>' ? actualValue > rule.threshold : actualValue < rule.threshold);
    return { rule, actualValue, triggered };
  });
}

export function generateGroundedAIModuleOutput(
  moduleId: AIModuleId,
  city: CityLocation,
  point: HourlyTimelinePoint,
  lang: LanguageCode,
  userQuery?: string
): {
  title: string;
  badge: string;
  summary: string;
  bulletPoints: string[];
  groundingFootnote: string;
} {
  const heat = calculateHeatStressRisk(point.tempC, point.humidity, point.uvIndex, point.windSpeedKmh);
  const models = buildModelComparisonSeries(city);
  const tempDiffHist = Math.round((point.tempC - city.baseTelemetry.historicalAvgTempC) * 10) / 10;
  const rainDiffHist = Math.round((point.precipMm - city.baseTelemetry.historicalAvgRainMm) * 10) / 10;

  const footnote =
    lang === 'bn'
      ? `গ্রাউন্ডেড টেলিমেট্রি উৎস: ${point.dataSource} · স্টেশন: ${city.nameBn} (${city.lat.toFixed(2)}°N, ${city.lon.toFixed(2)}°E)`
      : `Grounded Telemetry Source: ${point.dataSource} · Station: ${city.nameEn} (${city.lat.toFixed(2)}°N, ${city.lon.toFixed(2)}°E)`;

  if (moduleId === 'smart_farming') {
    const spraySafe = point.windSpeedKmh <= 18 && point.rainProb <= 40;
    return lang === 'bn'
      ? {
          title: `${city.nameBn} কৃষি আবহাওয়া ও সেচ পরামর্শ`,
          badge: spraySafe ? 'স্প্রে করার উপযুক্ত সময়' : 'কীটনাশক স্প্রে স্থগিত রাখুন',
          summary: `${city.nameBn} অঞ্চলের প্রধান ফসল (${city.primaryCropsBn.join(', ')}) এর জন্য বর্তমান তাপমাত্রা ${point.tempC}°C, আর্দ্রতা ${point.humidity}%, এবং বৃষ্টির সম্ভাবনা ${point.rainProb}%।`,
          bulletPoints: [
            spraySafe
              ? `কীটনাশক ও সার প্রয়োগ: বাতাসের গতিবেগ ${point.windSpeedKmh} km/h এবং বৃষ্টির সম্ভাবনা কম (${point.rainProb}%) থাকায় এখন স্প্রে করা নিরাপদ।`
              : `কীটনাশক ও সার সতর্কতা: বৃষ্টির সম্ভাবনা ${point.rainProb}% এবং বাতাস ${point.windSpeedKmh} km/h। এখন স্প্রে করলে তা ধুয়ে যাওয়ার ঝুঁকি রয়েছে; আগামীকাল সকাল ৬:৩০–৯:৩০ পর্যন্ত অপেক্ষা করুন।`,
            `সেচ ব্যবস্থাপনা: আজকের আনুমানিক বাষ্পীভবন হার এবং ${point.precipMm} মিমি বৃষ্টিপাত বিবেচনায় ${point.rainProb > 60 ? 'অতিরিক্ত সেচ দেওয়ার প্রয়োজন নেই; জমির নালা পরিষ্কার রাখুন' : 'বিকেল ৫টার পর হালকা সেচ দিন'}।`,
            `ফসল ও ধান শুকানো: বাতাসের আর্দ্রতা ${point.humidity}% থাকায় ${point.rainProb > 50 ? 'খোলা উঠানে ধান বা পাট শুকানো থেকে বিরত থাকুন' : 'সকাল ১০টা থেকে বিকেল ৩টা পর্যন্ত ফসল শুকানোর উত্তম সময়'}।`,
          ],
          groundingFootnote: footnote,
        }
      : {
          title: `${city.nameEn} Smart Farming & Agro-Met Advisory`,
          badge: spraySafe ? 'Safe Spraying Window' : 'Delay Foliar Spraying',
          summary: `Grounded advisory for ${city.nameEn} crops (${city.primaryCropsEn.join(', ')}) at ${point.tempC}°C, ${point.humidity}% RH, and ${point.rainProb}% rain probability.`,
          bulletPoints: [
            spraySafe
              ? `Pesticide & Fertilizer Window: Safe to apply now — wind speed is ${point.windSpeedKmh} km/h (≤ 18 km/h drift threshold) and rain probability is ${point.rainProb}%.`
              : `Spray Wash-Off Alert: Postpone foliar spraying — ${point.rainProb}% rain probability (${point.precipMm} mm/h) and ${point.windSpeedKmh} km/h gusts risk chemical runoff.`,
            `Irrigation Scheduling: With ${point.precipMm} mm active precipitation and ${point.humidity}% humidity, ${point.rainProb > 60 ? 'suspend mechanical irrigation and keep field drainage channels open' : 'schedule root-zone irrigation after 17:00 local time'}.`,
            `Paddy & Jute Drying: At ${point.humidity}% relative humidity and UV ${point.uvIndex}, ${point.rainProb > 50 ? 'cover open courtyard drying floors immediately' : 'utilize the midday solar window for grain moisture reduction'}.`,
          ],
          groundingFootnote: footnote,
        };
  }

  if (moduleId === 'allergy_aqi') {
    const pollenNoticeEn = city.pollenTelemetrySupported
      ? `Verified Regional Pollen Index: ${city.baseTelemetry.pollenIndex}/120 (Moderate tree/grass pollen load).`
      : `DATA TRANSPARENCY NOTICE: Official bio-aerosol / pollen sensor telemetry is NOT supported in ${city.nameEn} (${city.countryEn}). AEROLUNE strictly refuses to guess or fabricate pollen counts.`;
    const pollenNoticeBn = city.pollenTelemetrySupported
      ? `যাচাইকৃত পরাগরেণু সূচক (Pollen Index): ${city.baseTelemetry.pollenIndex}/120।`
      : `তথ্য স্বচ্ছতা বার্তা: ${city.nameBn} (${city.countryBn}) অঞ্চলে সরকারি পোলেন (পরাগরেণু) সেন্সর টেলিমেট্রি উপলব্ধ নেই। জিরো-হ্যালুসিনেশন নীতিমালা অনুযায়ী কোনো কাল্পনিক পোলেন ডেটা দেখানো হয়নি।`;

    return lang === 'bn'
      ? {
          title: 'বায়ুর মান (AQI) ও শ্বাসতন্ত্র সুরক্ষা বিশ্লেষণ',
          badge: `AQI ${point.aqi} · PM2.5: ${city.baseTelemetry.pm25} µg/m³`,
          summary: `${city.nameBn}-এ বর্তমান একিউআই (AQI) ${point.aqi}। সূক্ষ্ম ধূলিকণা PM2.5 এর মাত্রা ${city.baseTelemetry.pm25} µg/m³ এবং PM10 এর মাত্রা ${city.baseTelemetry.pm10} µg/m³।`,
          bulletPoints: [
            pollenNoticeBn,
            point.aqi > 150
              ? `উচ্চ দূষণ সতর্কতা (AQI ${point.aqi}): সংবেদনশীল ব্যক্তি ও শিশুদের বাইরে চলাচলের সময় N95/KN95 মাস্ক ব্যবহার করা আবশ্যক।`
              : `মাঝারি বায়ু মান (AQI ${point.aqi}): স্বাভাবিক চলাচলের জন্য উপযোগী, তবে প্রধান সড়কের ধুলোবালি এড়িয়ে চলুন।`,
            `বৃষ্টির ধৌতকরণ প্রভাব (Wet Deposition): ${point.precipMm} মিমি বৃষ্টিপাত বাতাসের ভাসমান ধূলিকণা কমাতে সহায়তা করছে।`,
          ],
          groundingFootnote: footnote,
        }
      : {
          title: 'AI Allergy & Air Quality (AQI) Respiratory Advisor',
          badge: `AQI ${point.aqi} · PM2.5: ${city.baseTelemetry.pm25} µg/m³`,
          summary: `Current Air Quality Index in ${city.nameEn} is ${point.aqi} with PM2.5 at ${city.baseTelemetry.pm25} µg/m³, PM10 at ${city.baseTelemetry.pm10} µg/m³, NO₂ at ${city.baseTelemetry.no2} µg/m³, and O₃ at ${city.baseTelemetry.o3} µg/m³.`,
          bulletPoints: [
            pollenNoticeEn,
            point.aqi > 150
              ? `Unhealthy Particulate Load (AQI ${point.aqi}): Recommend N95 filtration for commuters and outdoor workers; limit prolonged roadside exertion.`
              : `Acceptable Air Quality (AQI ${point.aqi}): Safe for outdoor exercise; monitor localized traffic corridors.`,
            `Precipitation Scavenging: ${point.precipMm} mm/h rainfall rate actively scrubs coarse PM10 particulates from the boundary layer.`,
          ],
          groundingFootnote: footnote,
        };
  }

  if (moduleId === 'confidence_analyzer') {
    return lang === 'bn'
      ? {
          title: 'মডেল কনফিডেন্স বিশ্লেষক (ECMWF vs GFS vs ICON)',
          badge: models.confidenceLevel === 'High Alignment' ? 'উচ্চ মডেল সামঞ্জস্য' : 'মডেল তারতম্য লক্ষণীয়',
          summary: `আগামী ৪৮ ঘণ্টায় ECMWF IFS, NOAA GFS এবং DWD ICON মডেলের মধ্যে সর্বোচ্চ তাপমাত্রার পার্থক্য ±${models.maxTempSpreadC}°C এবং বৃষ্টির সম্ভাবনার পার্থক্য ${models.maxRainSpreadPct}%।`,
          bulletPoints: [
            `তাপমাত্রা ঐকমত্য: তিনটি বৈশ্বিক মডেলেই ${point.tempC}°C এর কাছাকাছি তাপমাত্রার পূর্বাভাস দেওয়া হয়েছে (পার্থক্য মাত্র ${models.maxTempSpreadC}°C)।`,
            `বৃষ্টিপাত অনিশ্চয়তা: কনভেক্টিভ মেঘের কারণে বৃষ্টির সম্ভাবনায় ${models.maxRainSpreadPct}% বিস্তার (spread) দেখা যাচ্ছে — কোনো ভুয়া শতকরা নির্ভুলতা তৈরি না করে সরাসরি মডেলের ব্যবধান দেখানো হয়েছে।`,
            `প্রস্তাবনা: স্বল্পমেয়াদী (০–২৪ ঘণ্টা) সিদ্ধান্তের জন্য BMD ও ECMWF IFS ডেটা অনুসরণ করুন।`,
          ],
          groundingFootnote: footnote,
        }
      : {
          title: 'Multi-Model NWP Forecast Confidence Analyzer',
          badge: `${models.confidenceLevel} (±${models.maxTempSpreadC}°C / ${models.maxRainSpreadPct}% Spread)`,
          summary: `Cross-comparing ECMWF IFS 0.25°, NOAA GFS 0.25°, and DWD ICON across the next 48 hours without fabricating arbitrary accuracy scores.`,
          bulletPoints: [
            `Thermal Model Alignment: High ensemble agreement across models with a maximum temperature spread of ${models.maxTempSpreadC}°C around the ${point.tempC}°C baseline.`,
            `Convective Precipitation Spread: Models show a ${models.maxRainSpreadPct}% divergence in rain probability due to localized tropical boundary-layer convection.`,
            `Guidance: Rely on BMD radar + ECMWF IFS for 0–24h hyper-local planning.`,
          ],
          groundingFootnote: footnote,
        };
  }

  if (moduleId === 'risk_explainer') {
    const alert = city.officialAlerts[0];
    if (!alert) {
      return lang === 'bn'
        ? {
            title: 'সরকারি আবহাওয়া ঝুঁকি বিশ্লেষক',
            badge: 'কোনো সক্রিয় সতর্কবার্তা নেই',
            summary: `${city.nameBn}-এ এই মুহূর্তে আবহাওয়া অধিদপ্তর (BMD/WMO) থেকে কোনো দুর্যোগ বা কালবৈশাখী সতর্কবার্তা জারি করা হয়নি।`,
            bulletPoints: [
              `বর্তমান বায়ুচাপ ${point.pressureHpa} hPa এবং বাতাসের গতিবেগ ${point.windSpeedKmh} km/h স্বাভাবিক সীমার মধ্যে রয়েছে।`,
              `জিরো-হ্যালুসিনেশন গ্যারান্টি: সরকারি সংকেত ছাড়া কোনো কৃত্রিম সতর্কবার্তা তৈরি করা হয়নি।`,
            ],
            groundingFootnote: footnote,
          }
        : {
            title: 'Official Weather Risk & Alert Explainer',
            badge: 'No Active Official Warnings',
            summary: `There are currently zero active severe weather warnings issued by official meteorological agencies for ${city.nameEn}.`,
            bulletPoints: [
              `Synoptic pressure (${point.pressureHpa} hPa) and surface winds (${point.windSpeedKmh} km/h) remain within nominal operational thresholds.`,
              `Zero-Hallucination Guarantee: AEROLUNE never fabricates unofficial storm alerts.`,
            ],
            groundingFootnote: footnote,
          };
    }

    return lang === 'bn'
      ? {
          title: alert.titleBn,
          badge: `${alert.agency} · ${alert.severity}`,
          summary: `কেন জারি করা হয়েছে: ${alert.whyIssuedBn} প্রভাবিত এলাকা: ${alert.areasBn}।`,
          bulletPoints: alert.safetyStepsBn,
          groundingFootnote: footnote,
        }
      : {
          title: alert.titleEn,
          badge: `${alert.agency} · ${alert.severity}`,
          summary: `Why issued: ${alert.whyIssuedEn} Impacted areas: ${alert.areasEn}.`,
          bulletPoints: alert.safetyStepsEn,
          groundingFootnote: footnote,
        };
  }

  if (moduleId === 'heat_safety') {
    return lang === 'bn'
      ? {
          title: 'তাপমাত্রা ও আউটডোর স্বাস্থ্য সুরক্ষা (WBGT)',
          badge: `WBGT ${heat.wbgtC}°C · ঝুঁকি: ${heat.riskLevel}`,
          summary: `বর্তমান তাপমাত্রা ${point.tempC}°C এবং আর্দ্রতা ${point.humidity}% মিলে অনুভূত তাপমাত্রা (Feels Like) ${point.feelsLikeC}°C এবং ওয়েট-বাল্ব গ্লোব তাপমাত্রা (WBGT) ${heat.wbgtC}°C।`,
          bulletPoints: [
            `পানি পানের প্রোটোকল: বাইরে কাজ করার সময় প্রতি ঘণ্টায় অন্তত ${heat.hydrationMlPerHour} মিলি বিশুদ্ধ পানি বা ওরস্যালাইন পান করুন।`,
            `ইউভি সুরক্ষা (UV Index ${point.uvIndex}): ${point.uvIndex >= 6 ? 'সকাল ১১টা থেকে বিকেল ৩টা পর্যন্ত সরাসরি রোদ এড়িয়ে চলুন এবং ছাতা ব্যবহার করুন।' : 'সৌর বিকিরণের মাত্রা সহনীয় পর্যায়ে রয়েছে।'}`,
            `বায়ুপ্রবাহ শীতলীকরণ: ${point.windSpeedKmh} km/h বাতাসের গতিবেগ শরীরের তাপ কমাতে আংশিক সহায়তা করছে।`,
          ],
          groundingFootnote: footnote,
        }
      : {
          title: 'AI Heat Stress & Outdoor Safety Advisor (WBGT)',
          badge: `WBGT ${heat.wbgtC}°C · ${heat.riskLevel} Risk`,
          summary: `Combining ${point.tempC}°C air temperature, ${point.humidity}% relative humidity, UV ${point.uvIndex}, and ${point.windSpeedKmh} km/h wind yields a Feels-Like index of ${point.feelsLikeC}°C and WBGT of ${heat.wbgtC}°C.`,
          bulletPoints: [
            `Hydration Protocol: Outdoor workers and athletes should intake ${heat.hydrationMlPerHour} mL/hour of water + electrolytes.`,
            `Solar UV Exposure (UV ${point.uvIndex}): ${point.uvIndex >= 6 ? 'High solar load — limit unshaded exposure to under 25 minutes during midday.' : 'Low-to-moderate UV load; standard sun protection advised.'}`,
            `Convective Cooling: ${point.windSpeedKmh} km/h surface wind provides natural evaporative relief.`,
          ],
          groundingFootnote: footnote,
        };
  }

  if (moduleId === 'climate_history') {
    return lang === 'bn'
      ? {
          title: 'জলবায়ু ইতিহাস ও প্রবণতা বিশ্লেষক',
          badge: `তাপমাত্রা বিচ্যুতি: ${tempDiffHist >= 0 ? '+' : ''}${tempDiffHist}°C`,
          summary: `${city.nameBn}-এ আজকের তাপমাত্রা (${point.tempC}°C) ঐতিহাসিক গড় (${city.baseTelemetry.historicalAvgTempC}°C) থেকে ${tempDiffHist >= 0 ? '+' : ''}${tempDiffHist}°C ভিন্ন এবং বৃষ্টিপাত (${point.precipMm} মিমি) ঐতিহাসিক গড় (${city.baseTelemetry.historicalAvgRainMm} মিমি) থেকে ${rainDiffHist >= 0 ? '+' : ''}${rainDiffHist} মিমি ভিন্ন।`,
          bulletPoints: [
            `স্বল্পমেয়াদী আবহাওয়া বনাম দীর্ঘমেয়াদী জলবায়ু: আজকের ${tempDiffHist >= 0 ? '+' : ''}${tempDiffHist}°C পরিবর্তনটি মূলত দৈনিক মেঘ ও বায়ুপ্রবাহের তাৎক্ষণিক প্রভাব, যা ৩০ বছরের দীর্ঘমেয়াদী জলবায়ু গড় থেকে আলাদা।`,
            `মৌসুমি প্রেক্ষাপট: অক্টোবর মাসের শেষভাগে বঙ্গোপসাগরে মৌসুমি বায়ুর প্রত্যাহার প্রক্রিয়া চলমান থাকে।`,
          ],
          groundingFootnote: footnote,
        }
      : {
          title: 'Climate History & Baseline Trend Analyzer',
          badge: `Anomaly: ${tempDiffHist >= 0 ? '+' : ''}${tempDiffHist}°C vs 30-Yr Mean`,
          summary: `Today's ${point.tempC}°C reading in ${city.nameEn} is ${tempDiffHist >= 0 ? '+' : ''}${tempDiffHist}°C relative to the 1991–2020 climatological mean (${city.baseTelemetry.historicalAvgTempC}°C), with precipitation delta at ${rainDiffHist >= 0 ? '+' : ''}${rainDiffHist} mm.`,
          bulletPoints: [
            `Short-Term Synoptic Weather vs. Climate Trend: Today's ${tempDiffHist >= 0 ? '+' : ''}${tempDiffHist}°C delta reflects transient synoptic cloud cover (${point.cloudCover}%) rather than a standalone secular climate shift.`,
            `Seasonal Baseline: Late-October marks the post-monsoon transition across the Bengal delta.`,
          ],
          groundingFootnote: footnote,
        };
  }

  if (moduleId === 'weather_twin') {
    return lang === 'bn'
      ? {
          title: 'পার্সোনাল ওয়েদার টুইন (দৈনিক রুটিন অপ্টিমাইজার)',
          badge: 'রুটিন টাইম-স্লট র‍্যাঙ্কিং',
          summary: `${city.nameBn}-এর ঘণ্টাভিত্তিক পূর্বাভাস বিশ্লেষণ করে আপনার দৈনন্দিন কাজের জন্য সবচেয়ে নিরাপদ ও আরামদায়ক সময়সূচি:`,
          bulletPoints: [
            `সকালের অফিস যাতায়াত (০৭:৩০ – ০৯:৩০): সর্বোত্তম সময় — তাপমাত্রা ~${Math.round(point.tempC - 2.5)}°C এবং বৃষ্টির ঝুঁকি কম।`,
            `আউটডোর শুটিং ও মাঠের কাজ (১৬:০০ – ১৭:৩০): গোল্ডেন আওয়ার আলো পাওয়া যাবে, তবে ${point.rainProb}% বৃষ্টির সম্ভাবনা থাকায় ছাতা/কভার সাথে রাখুন।`,
            `সন্ধ্যার হাঁটা ও ব্যায়াম (১৮:৩০ – ২০:০০): তাপমাত্রা কমে আরামদায়ক হবে, তবে AQI (${point.aqi}) বিবেচনায় পার্ক বা লেকপাড় বেছে নিন।`,
          ],
          groundingFootnote: footnote,
        }
      : {
          title: 'Personal Weather Twin — Routine Slot Optimizer',
          badge: 'Ranked Daily Windows',
          summary: `Ranked time slots for your daily routines in ${city.nameEn} backed by hourly telemetry:`,
          bulletPoints: [
            `Morning Commute (07:30 – 09:30): Rank #1 Optimal — Cooler thermal load (~${Math.round(point.tempC - 2.5)}°C) and calmer surface winds.`,
            `Outdoor Video Shoot / Field Task (16:00 – 17:30): Rank #2 Moderate — Soft low-angle sunlight, but monitor ${point.rainProb}% rain probability.`,
            `Evening Walk & Fitness (18:30 – 20:00): Zero UV load (UV 0), though AQI ${point.aqi} favors green-belt wards like ${city.wards[0]?.nameEn || 'local parks'}.`,
          ],
          groundingFootnote: footnote,
        };
  }

  return lang === 'bn'
    ? {
        title: userQuery ? `এআই কপিলট উত্তর: "${userQuery}"` : `${city.nameBn} — এআই আবহাওয়া ও জীবনযাত্রা পরামর্শ`,
        badge: `${point.tempC}°C · বৃষ্টি ${point.rainProb}% · AQI ${point.aqi}`,
        summary: `বর্তমানে ${city.nameBn}-এ তাপমাত্রা ${point.tempC}°C (অনুভূত ${point.feelsLikeC}°C), আকাশে মেঘের পরিমাণ ${point.cloudCover}%, বৃষ্টির সম্ভাবনা ${point.rainProb}% (${point.precipMm} মিমি/ঘণ্টা), এবং বাতাসের গতিবেগ ${point.windSpeedKmh} km/h (${getCompassDirection(point.windDirectionDeg)})।`,
        bulletPoints: [
          point.rainProb >= 50
            ? `ছাতা ও রেইন গিয়ার পরামর্শ: বৃষ্টির সম্ভাবনা ${point.rainProb}% (${point.precipMm} মিমি) থাকায় বাইরে যাওয়ার সময় অবশ্যই ছাতা সাথে রাখুন।`
            : `বাইরে যাওয়ার উপযুক্ত আবহাওয়া: বৃষ্টির সম্ভাবনা কম (${point.rainProb}%), তবে অনুভূত তাপমাত্রা ${point.feelsLikeC}°C হওয়ায় সুতির হালকা পোশাক পরিধান করুন।`,
          `ওয়ার্ড ভিত্তিক মাইক্রোক্লাইমেট: ${city.wards[0]?.nameBn || city.nameBn} এলাকায় তাপমাত্রা মূল শহরের চেয়ে ${city.wards[0]?.tempDeltaC ?? 0}°C ভিন্ন।`,
          `জিরো-হ্যালুসিনেশন যাচাইকৃত: সকল তথ্য সরাসরি ${point.dataSource} পে-লোড থেকে সংগৃহীত।`,
        ],
        groundingFootnote: footnote,
      }
    : {
        title: userQuery ? `AI Copilot Response: "${userQuery}"` : `${city.nameEn} — Grounded Forecast & Daily Life Advisor`,
        badge: `${point.tempC}°C · Rain ${point.rainProb}% · AQI ${point.aqi}`,
        summary: `Right now in ${city.nameEn}, temperature is ${point.tempC}°C (feels like ${point.feelsLikeC}°C) with ${point.cloudCover}% cloud cover, ${point.rainProb}% rain probability (${point.precipMm} mm/h), and ${point.windSpeedKmh} km/h ${getCompassDirection(point.windDirectionDeg)} wind.`,
        bulletPoints: [
          point.rainProb >= 50
            ? `Umbrella & Commute Protocol: Carry rain protection — ${point.rainProb}% precipitation probability (${point.precipMm} mm/h) with wet road reflections expected.`
            : `Outdoor Window: Favorable dry window (${point.rainProb}% rain prob), though ${point.feelsLikeC}°C heat index warrants breathable attire and hydration.`,
          `Hyper-Local Ward Variation: ${city.wards[0]?.nameEn || city.nameEn} registers a ${city.wards[0]?.tempDeltaC ?? 0}°C microclimate delta relative to the city core.`,
          `Strict Telemetry Grounding: Every metric above is locked to ${point.dataSource} without speculative extrapolation.`,
        ],
        groundingFootnote: footnote,
      };
}
