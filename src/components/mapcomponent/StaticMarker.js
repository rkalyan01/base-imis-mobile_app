import React, { useEffect, useState } from "react";
import { Marker } from "react-native-maps";

// How long a marker keeps redrawing its custom view after mounting or after its
// content changes. Long enough for a local image or text to finish rendering.
const SETTLE_MS = 500;

// Marker with a custom view (image, icon or text) that does not flicker.
// On Android, react-native-maps redraws a custom marker view on every frame
// while tracksViewChanges is on (the default), so pins and labels blink and
// taps on them are often lost. This marker redraws only briefly after it mounts
// and whenever `redrawKey` changes (pass whatever the view depends on, e.g. the
// label text), then stops.
const StaticMarker = ({ redrawKey, children, ...props }) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [redrawKey]);

  return (
    <Marker {...props} tracksViewChanges={tracksViewChanges}>
      {children}
    </Marker>
  );
};

export default StaticMarker;
