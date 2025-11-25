(function () {
  const countries = [
    {
      code: 'AU',
      name: 'Australia',
      zones: [
        {
          id: 'Australia/Perth',
          label: 'Australian Western Time — Perth',
          offset: 'UTC+08:00',
          lat: -31.9523,
          lon: 115.8613
        },
        {
          id: 'Australia/Adelaide',
          label: 'Australian Central Time — Adelaide',
          offset: 'UTC+09:30',
          lat: -34.9285,
          lon: 138.6007
        },
        {
          id: 'Australia/Brisbane',
          label: 'Australian Eastern Time — Brisbane',
          offset: 'UTC+10:00',
          lat: -27.4698,
          lon: 153.0251
        },
        {
          id: 'Australia/Sydney',
          label: 'Australian Eastern Time — Sydney',
          offset: 'UTC+10:00',
          isPrimary: true,
          lat: -33.8688,
          lon: 151.2093
        }
      ]
    },
    {
      code: 'BR',
      name: 'Brazil',
      zones: [
        {
          id: 'America/Sao_Paulo',
          label: 'Brasilia Time — São Paulo',
          offset: 'UTC-03:00',
          isPrimary: true,
          lat: -23.5505,
          lon: -46.6333
        }
      ]
    },
    {
      code: 'CA',
      name: 'Canada',
      zones: [
        {
          id: 'America/Vancouver',
          label: 'Pacific Time — Vancouver',
          offset: 'UTC-08:00',
          lat: 49.2827,
          lon: -123.1207
        },
        {
          id: 'America/Edmonton',
          label: 'Mountain Time — Edmonton',
          offset: 'UTC-07:00',
          lat: 53.5461,
          lon: -113.4938
        },
        {
          id: 'America/Toronto',
          label: 'Eastern Time — Toronto',
          offset: 'UTC-05:00',
          isPrimary: true,
          lat: 43.6532,
          lon: -79.3832
        },
        {
          id: 'America/Halifax',
          label: 'Atlantic Time — Halifax',
          offset: 'UTC-04:00',
          lat: 44.6488,
          lon: -63.5752
        }
      ]
    },
    {
      code: 'CN',
      name: 'China',
      zones: [
        {
          id: 'Asia/Shanghai',
          label: 'China Standard Time — Shanghai',
          offset: 'UTC+08:00',
          isPrimary: true,
          lat: 31.2304,
          lon: 121.4737
        }
      ]
    },
    {
      code: 'FR',
      name: 'France',
      zones: [
        {
          id: 'Europe/Paris',
          label: 'Central European Time — Paris',
          offset: 'UTC+01:00',
          isPrimary: true,
          lat: 48.8566,
          lon: 2.3522
        }
      ]
    },
    {
      code: 'DE',
      name: 'Germany',
      zones: [
        {
          id: 'Europe/Berlin',
          label: 'Central European Time — Berlin',
          offset: 'UTC+01:00',
          isPrimary: true,
          lat: 52.52,
          lon: 13.405
        }
      ]
    },
    {
      code: 'HK',
      name: 'Hong Kong',
      zones: [
        {
          id: 'Asia/Hong_Kong',
          label: 'Hong Kong Time — Hong Kong',
          offset: 'UTC+08:00',
          isPrimary: true,
          lat: 22.3193,
          lon: 114.1694
        }
      ]
    },
    {
      code: 'IN',
      name: 'India',
      zones: [
        {
          id: 'Asia/Kolkata',
          label: 'India Standard Time — Kolkata',
          offset: 'UTC+05:30',
          isPrimary: true,
          lat: 22.5726,
          lon: 88.3639
        }
      ]
    },
    {
      code: 'ID',
      name: 'Indonesia',
      zones: [
        {
          id: 'Asia/Jakarta',
          label: 'Western Indonesia Time — Jakarta',
          offset: 'UTC+07:00',
          isPrimary: true,
          lat: -6.2088,
          lon: 106.8456
        }
      ]
    },
    {
      code: 'IE',
      name: 'Ireland',
      zones: [
        {
          id: 'Europe/Dublin',
          label: 'Greenwich Mean Time — Dublin',
          offset: 'UTC+00:00',
          isPrimary: true,
          lat: 53.3498,
          lon: -6.2603
        }
      ]
    },
    {
      code: 'IT',
      name: 'Italy',
      zones: [
        {
          id: 'Europe/Rome',
          label: 'Central European Time — Rome',
          offset: 'UTC+01:00',
          isPrimary: true,
          lat: 41.9028,
          lon: 12.4964
        }
      ]
    },
    {
      code: 'JP',
      name: 'Japan',
      zones: [
        {
          id: 'Asia/Tokyo',
          label: 'Japan Standard Time — Tokyo',
          offset: 'UTC+09:00',
          isPrimary: true,
          lat: 35.6762,
          lon: 139.6503
        }
      ]
    },
    {
      code: 'MX',
      name: 'Mexico',
      zones: [
        {
          id: 'America/Mexico_City',
          label: 'Central Time — Mexico City',
          offset: 'UTC-06:00',
          isPrimary: true,
          lat: 19.4326,
          lon: -99.1332
        },
        {
          id: 'America/Tijuana',
          label: 'Pacific Time — Tijuana',
          offset: 'UTC-08:00',
          lat: 32.5149,
          lon: -117.0382
        }
      ]
    },
    {
      code: 'NL',
      name: 'Netherlands',
      zones: [
        {
          id: 'Europe/Amsterdam',
          label: 'Central European Time — Amsterdam',
          offset: 'UTC+01:00',
          isPrimary: true,
          lat: 52.3676,
          lon: 4.9041
        }
      ]
    },
    {
      code: 'NZ',
      name: 'New Zealand',
      zones: [
        {
          id: 'Pacific/Auckland',
          label: 'New Zealand Time — Auckland',
          offset: 'UTC+12:00',
          isPrimary: true,
          lat: -36.8485,
          lon: 174.7633
        }
      ]
    },
    {
      code: 'PT',
      name: 'Portugal',
      zones: [
        {
          id: 'Europe/Lisbon',
          label: 'Western European Time — Lisbon',
          offset: 'UTC+00:00',
          isPrimary: true,
          lat: 38.7223,
          lon: -9.1393
        }
      ]
    },
    {
      code: 'RU',
      name: 'Russia',
      zones: [
        {
          id: 'Europe/Moscow',
          label: 'Moscow Time — Moscow',
          offset: 'UTC+03:00',
          isPrimary: true,
          lat: 55.7558,
          lon: 37.6173
        }
      ]
    },
    {
      code: 'SG',
      name: 'Singapore',
      zones: [
        {
          id: 'Asia/Singapore',
          label: 'Singapore Time — Singapore',
          offset: 'UTC+08:00',
          isPrimary: true,
          lat: 1.3521,
          lon: 103.8198
        }
      ]
    },
    {
      code: 'ZA',
      name: 'South Africa',
      zones: [
        {
          id: 'Africa/Johannesburg',
          label: 'South Africa Standard Time — Johannesburg',
          offset: 'UTC+02:00',
          isPrimary: true,
          lat: -26.2041,
          lon: 28.0473
        }
      ]
    },
    {
      code: 'KR',
      name: 'South Korea',
      zones: [
        {
          id: 'Asia/Seoul',
          label: 'Korea Standard Time — Seoul',
          offset: 'UTC+09:00',
          isPrimary: true,
          lat: 37.5665,
          lon: 126.978
        }
      ]
    },
    {
      code: 'ES',
      name: 'Spain',
      zones: [
        {
          id: 'Europe/Madrid',
          label: 'Central European Time — Madrid',
          offset: 'UTC+01:00',
          isPrimary: true,
          lat: 40.4168,
          lon: -3.7038
        }
      ]
    },
    {
      code: 'TH',
      name: 'Thailand',
      zones: [
        {
          id: 'Asia/Bangkok',
          label: 'Indochina Time — Bangkok',
          offset: 'UTC+07:00',
          isPrimary: true,
          lat: 13.7563,
          lon: 100.5018
        }
      ]
    },
    {
      code: 'AE',
      name: 'United Arab Emirates',
      zones: [
        {
          id: 'Asia/Dubai',
          label: 'Gulf Standard Time — Dubai',
          offset: 'UTC+04:00',
          isPrimary: true,
          lat: 25.2048,
          lon: 55.2708
        }
      ]
    },
    {
      code: 'GB',
      name: 'United Kingdom',
      zones: [
        {
          id: 'Europe/London',
          label: 'Greenwich Mean Time — London',
          offset: 'UTC+00:00',
          isPrimary: true,
          lat: 51.5072,
          lon: -0.1276
        }
      ]
    },
    {
      code: 'US',
      name: 'United States',
      zones: [
        {
          id: 'Pacific/Honolulu',
          label: 'Hawaii Time — Honolulu',
          offset: 'UTC-10:00',
          lat: 21.3069,
          lon: -157.8583
        },
        {
          id: 'America/Anchorage',
          label: 'Alaska Time — Anchorage',
          offset: 'UTC-09:00',
          lat: 61.2181,
          lon: -149.9003
        },
        {
          id: 'America/Los_Angeles',
          label: 'Pacific Time — Los Angeles',
          offset: 'UTC-08:00',
          lat: 34.0522,
          lon: -118.2437
        },
        {
          id: 'America/Denver',
          label: 'Mountain Time — Denver',
          offset: 'UTC-07:00',
          lat: 39.7392,
          lon: -104.9903
        },
        {
          id: 'America/Phoenix',
          label: 'Mountain Time (no DST) — Phoenix',
          offset: 'UTC-07:00',
          lat: 33.4484,
          lon: -112.074
        },
        {
          id: 'America/Chicago',
          label: 'Central Time — Chicago',
          offset: 'UTC-06:00',
          lat: 41.8781,
          lon: -87.6298
        },
        {
          id: 'America/New_York',
          label: 'Eastern Time — New York',
          offset: 'UTC-05:00',
          isPrimary: true,
          lat: 40.7128,
          lon: -74.006
        }
      ]
    },
    {
      code: 'UTC',
      name: 'UTC',
      zones: [
        {
          id: 'UTC',
          label: 'UTC',
          offset: 'UTC+00:00',
          isPrimary: true,
          lat: 0,
          lon: 0
        }
      ]
    }
  ];

  const zoneIndex = new Map();
  countries.forEach((country) => {
    country.zones.forEach((zone) => {
      zoneIndex.set(zone.id, { ...zone, countryCode: country.code, countryName: country.name });
    });
  });

  window.timeZoneData = { countries, zoneIndex };
})();
