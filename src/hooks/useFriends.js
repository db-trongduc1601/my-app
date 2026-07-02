import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Real-time accepted-friends list for the current user, in both directions
 * (records where I'm the owner OR the friend).
 *
 * Returns:
 *  - friends:      accepted friend records ({ id, ...data })
 *  - friendEmails: unique lowercased emails of the other party (excludes me)
 *  - loading:      true until the first snapshot from both directions resolves
 *
 * Replaces the getDocs(owner) + getDocs(friend) pattern that Games/Caro
 * duplicated; realtime instead of one-shot so the list stays fresh.
 */
export function useFriends() {
  const myEmail = auth.currentUser?.email?.toLowerCase() || '';
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myEmail) {
      setFriends([]);
      setLoading(false);
      return;
    }

    let asOwner = [];
    let asFriend = [];
    let seenOwner = false;
    let seenFriend = false;

    const merge = () => {
      setFriends([...asOwner, ...asFriend]);
      if (seenOwner && seenFriend) setLoading(false);
    };

    const q1 = query(
      collection(db, 'friends'),
      where('owner_email', '==', myEmail),
      where('status', '==', 'accepted')
    );
    const q2 = query(
      collection(db, 'friends'),
      where('friend_email', '==', myEmail),
      where('status', '==', 'accepted')
    );

    const unsub1 = onSnapshot(q1, (snap) => {
      asOwner = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      seenOwner = true;
      merge();
    }, () => { seenOwner = true; merge(); });

    const unsub2 = onSnapshot(q2, (snap) => {
      asFriend = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      seenFriend = true;
      merge();
    }, () => { seenFriend = true; merge(); });

    return () => { unsub1(); unsub2(); };
  }, [myEmail]);

  const friendEmails = useMemo(() => {
    const set = new Set();
    friends.forEach((r) => {
      const other = r.owner_email?.toLowerCase() === myEmail
        ? r.friend_email
        : r.owner_email;
      if (other) set.add(other.toLowerCase());
    });
    return [...set];
  }, [friends, myEmail]);

  return { friends, friendEmails, loading };
}
