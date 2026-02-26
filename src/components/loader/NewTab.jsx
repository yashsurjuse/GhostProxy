import Search from '../SearchContainer';
import QuickLinks from '../QuickLinks';
import Logo from '../Logo';
import Footer from '../Footer';
import {
  Battery,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
} from 'lucide-react';

import { process } from '/src/utils/hooks/loader/utils';
import { useOptions } from '/src/utils/optionsContext';
import { useEffect, useMemo, useState } from 'react';
import loaderStore from '/src/utils/hooks/loader/useLoaderStore';
import { createId } from '/src/utils/id';

const NewTab = ({ id, updateFn }) => {
  const { options } = useOptions();
  const addTab = loaderStore((state) => state.addTab);
  const setActive = loaderStore((state) => state.setActive);
  const [menuClockNow, setMenuClockNow] = useState(Date.now());
  const [batteryInfo, setBatteryInfo] = useState({ level: null, charging: false });
  const [ipMeta, setIpMeta] = useState({ timezone: '', latitude: null, longitude: null, city: '' });
  const [menuWeather, setMenuWeather] = useState({ temp: null, weatherCode: null, isDay: true });

  const parseCoords = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const [latRaw, lonRaw] = raw.split(',').map((p) => p?.trim?.() || '');
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  };

  const weatherUnitLabel = (options.weatherUnit || 'fahrenheit') === 'celsius' ? 'C' : 'F';

  const weatherIcon = useMemo(() => {
    const code = Number(menuWeather.weatherCode);
    if (!Number.isFinite(code)) return Cloud;
    if (code === 0) return Sun;
    if (code === 45 || code === 48) return CloudFog;
    if ([95, 96, 99].includes(code)) return CloudLightning;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
    if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
    return Cloud;
  }, [menuWeather.weatherCode]);

  const effectiveTimezone = useMemo(() => {
    const override = String(options.timezoneOverride || '').trim();
    if (override) return override;
    if (ipMeta.timezone) return ipMeta.timezone;
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, [options.timezoneOverride, ipMeta.timezone]);

  const menuTimeLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !(options.clock24Hour === true),
        timeZone: effectiveTimezone,
      }).format(menuClockNow);
    } catch {
      return new Date(menuClockNow).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !(options.clock24Hour === true),
      });
    }
  }, [menuClockNow, options.clock24Hour, effectiveTimezone]);

  useEffect(() => {
    const map = {
      duckduckgo: 'https://duckduckgo.com',
      google: 'https://google.com',
      blank: 'about:blank',
    };

    const selected = options.newTabPage || 'ghost';
    const target = map[selected];
    if (!target) return;

    if (target === 'about:blank') {
      updateFn(id, target, false);
      return;
    }

    const processed = process(target, false, options.prType || 'auto', options.engine || null);
    updateFn(id, processed, false);
  }, [id, updateFn, options.newTabPage, options.prType, options.engine]);

  useEffect(() => {
    const interval = setInterval(() => setMenuClockNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBattery = async () => {
      try {
        const battery = await navigator.getBattery?.();
        if (!battery || cancelled) return;

        const update = () => {
          if (cancelled) return;
          setBatteryInfo({
            level: Math.round((battery.level || 0) * 100),
            charging: !!battery.charging,
          });
        };

        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      } catch {}
    };

    loadBattery();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const parseProviderMeta = (payload, source) => {
      if (!payload || typeof payload !== 'object') return null;

      if (source === 'ipapi') {
        return {
          timezone: String(payload.timezone || ''),
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          city: String(payload.city || ''),
        };
      }

      if (source === 'ipwho') {
        return {
          timezone: String(payload?.timezone?.id || ''),
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          city: String(payload.city || ''),
        };
      }

      if (source === 'ipinfo') {
        const loc = String(payload.loc || '').split(',');
        return {
          timezone: String(payload.timezone || ''),
          latitude: Number(loc[0]),
          longitude: Number(loc[1]),
          city: String(payload.city || ''),
        };
      }

      return null;
    };

    const isValidMeta = (meta) =>
      !!meta &&
      Number.isFinite(meta.latitude) &&
      Number.isFinite(meta.longitude) &&
      meta.latitude >= -90 &&
      meta.latitude <= 90 &&
      meta.longitude >= -180 &&
      meta.longitude <= 180;

    const getBrowserCoords = () =>
      new Promise((resolve) => {
        try {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
                latitude: Number(position.coords?.latitude),
                longitude: Number(position.coords?.longitude),
                city: '',
              });
            },
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60 * 1000 },
          );
        } catch {
          resolve(null);
        }
      });

    const fetchIpMeta = async () => {
      const geo = await getBrowserCoords();
      if (!cancelled && isValidMeta(geo)) {
        setIpMeta(geo);
        return;
      }

      const providers = [
        { url: 'https://ipapi.co/json/', source: 'ipapi' },
        { url: 'https://ipwho.is/', source: 'ipwho' },
        { url: 'https://ipinfo.io/json', source: 'ipinfo' },
      ];

      for (const provider of providers) {
        try {
          const response = await fetch(provider.url);
          if (!response.ok) continue;
          const data = await response.json();
          const parsed = parseProviderMeta(data, provider.source);
          if (!isValidMeta(parsed)) continue;
          if (cancelled) return;
          setIpMeta(parsed);
          return;
        } catch {}
      }
    };

    fetchIpMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async () => {
      try {
        let coords = null;
        if (options.weatherUseIpLocation === false) {
          coords = parseCoords(options.weatherCoordsOverride || '');
        }

        if (!coords && Number.isFinite(ipMeta.latitude) && Number.isFinite(ipMeta.longitude)) {
          coords = { lat: ipMeta.latitude, lon: ipMeta.longitude };
        }

        if (!coords) return;

        const unit = (options.weatherUnit || 'fahrenheit') === 'celsius' ? 'celsius' : 'fahrenheit';
        const query = new URLSearchParams({
          latitude: String(coords.lat),
          longitude: String(coords.lon),
          current: `temperature_2m,weather_code,is_day`,
          temperature_unit: unit,
          timezone: 'auto',
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const current = data?.current || {};
        setMenuWeather({
          temp: Number.isFinite(Number(current.temperature_2m)) ? Number(current.temperature_2m) : null,
          weatherCode: Number.isFinite(Number(current.weather_code)) ? Number(current.weather_code) : null,
          isDay: Number(current.is_day) === 1,
        });
      } catch {}
    };

    fetchWeather();
    const timer = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [options.weatherUseIpLocation, options.weatherCoordsOverride, options.weatherUnit, ipMeta.latitude, ipMeta.longitude]);

  const navigating = {
    id: id,
    go: updateFn,
    process: process,
    openInNewTab: (url) => {
      if (!url) return;
      const processed = process(url, false, options.prType || 'auto', options.engine || null);
      if (loaderStore.getState().tabs.length >= 20) return;
      const tabId = createId();
      addTab({ title: 'New Tab', id: tabId, url: processed });
      setActive(tabId);
    },
  };

  if ((options.newTabPage || 'ghost') !== 'ghost') {
    return <div className="h-full w-full" />;
  }

  return (
    <>
      <div className="h-[calc(100%-100px)] flex flex-col items-center justify-center p-6 gap-8">
        <div className="w-full max-w-2xl">
          <div className="flex justify-center w-full">
            <Logo options="w-[15.8rem] h-30 mr-5 mb-2" />
          </div>
          <Search nav={false} logo={false} cls="-mt-3 absolute z-50" navigating={navigating} />
          <QuickLinks cls="mt-16" nav={false} navigating={navigating} />
        </div>
      </div>
      <div className="fixed left-1/2 -translate-x-9/24 bottom-3 z-[121]">
        <div className="inline-flex items-center gap-4 sm:gap-6 px-3 py-1.5 rounded-md border border-white/10 bg-black/10 text-[12px] sm:text-[13px] text-[#b4bcc8]">
          <span>{menuTimeLabel}</span>
          <span className="inline-flex items-center gap-1.5">
            <Battery size={13} />
            {Number.isFinite(batteryInfo.level) ? `${batteryInfo.level}%` : '--'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {(() => {
              const WxIcon = weatherIcon;
              return <WxIcon size={13} />;
            })()}
            {Number.isFinite(menuWeather.temp) ? `${Math.round(menuWeather.temp)}°${weatherUnitLabel}` : '--'}
          </span>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default NewTab;
