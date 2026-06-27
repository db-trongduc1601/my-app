import { useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, serverTimestamp, doc } from 'firebase/firestore';

export function usePresenceHeartbeat(currentUser) {
  const profileDocIdRef = useRef(null);

  useEffect(() => {
    if (!currentUser || !currentUser.email) return;

    let heartbeatInterval = null;
    let isFetchingProfile = false;

    const fetchProfileDocId = async () => {
      if (profileDocIdRef.current || isFetchingProfile) return profileDocIdRef.current;
      isFetchingProfile = true;
      try {
        const q = query(collection(db, 'user_profiles'), where('email', '==', currentUser.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          profileDocIdRef.current = snapshot.docs[0].id;
        }
      } catch (error) {
        console.error("Error fetching profile doc id for presence:", error);
      } finally {
        isFetchingProfile = false;
      }
      return profileDocIdRef.current;
    };

    const sendHeartbeat = async () => {
      if (document.visibilityState !== 'visible') return;

      const docId = await fetchProfileDocId();
      if (!docId) return;

      try {
        await updateDoc(doc(db, 'user_profiles', docId), {
          last_active: serverTimestamp()
        });
      } catch (error) {
        // Ignore silently
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(sendHeartbeat, 25000);
      } else {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      }
    };

    // Initial heartbeat
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
      heartbeatInterval = setInterval(sendHeartbeat, 25000);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [currentUser]);
}
