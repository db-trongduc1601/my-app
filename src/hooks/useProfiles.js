import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Real-time map of all user_profiles, keyed by lowercase email.
 *
 * Returns the same shape (`{ [emailLower]: profileData }`) that several
 * components used to build inline, so reads like `profiles[email.toLowerCase()]`
 * stay unchanged.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'user_profiles'), (snap) => {
      const map = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.email) map[data.email.toLowerCase()] = data;
      });
      setProfiles(map);
    });
    return () => unsub();
  }, []);

  const getProfile = (email) => (email ? profiles[email.toLowerCase()] : undefined);

  return { profiles, getProfile };
}
