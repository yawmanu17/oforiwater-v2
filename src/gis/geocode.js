export async function geocodeAddress(address) {
  if (!address || address.trim().length < 5) {
    return null;
  }

  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      addressdetails: '1'
    }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Geocoding failed.');
  }

  const results = await response.json();

  if (!results.length) {
    return null;
  }

  return {
    lat: Number(results[0].lat),
    lon: Number(results[0].lon),
    displayName: results[0].display_name,
    source: 'Address Geocoded'
  };
}

export function getCurrentGpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'GPS Verified'
        });
      },
      error => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}