import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";

// Read configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyClu6asaFPyNkf8GCKy9LITqMinMbQLqcY",
  authDomain: "test-b7ca3.firebaseapp.com",
  projectId: "test-b7ca3",
  storageBucket: "test-b7ca3.firebasestorage.app",
  messagingSenderId: "889581195283",
  appId: "1:889581195283:web:c3be48e7ea573480d2afe6"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  streak: number;
  date: string;
}

/**
 * Subscribes to real-time leaderboard updates.
 * We fetch the top 20 scores using a single-field query (which never requires manual indexes),
 * then we sort and slice to the top 10 in memory for absolute reliability.
 */
export function subscribeToLeaderboard(callback: (entries: LeaderboardEntry[]) => void) {
  const leaderboardRef = collection(db, "leaderboard");
  const q = query(
    leaderboardRef, 
    orderBy("score", "desc"),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const entries: LeaderboardEntry[] = [];
    snapshot.forEach((document) => {
      const data = document.data();
      entries.push({
        id: document.id,
        name: data.name || "匿名小學家",
        score: Number(data.score) || 0,
        streak: Number(data.streak) || 0,
        date: data.date || ""
      });
    });

    // Stable sort by score descending, and slice to top 10
    const sorted = entries
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    callback(sorted);
  }, (error) => {
    console.error("Error subscribing to leaderboard:", error);
  });
}

/**
 * Submits a new score to the online leaderboard
 */
export async function submitScore(name: string, score: number, streak: number) {
  const leaderboardRef = collection(db, "leaderboard");
  const dateStr = new Date().toISOString().split('T')[0];
  
  await addDoc(leaderboardRef, {
    name: name.trim() || "匿名小學家",
    score: score,
    streak: streak,
    date: dateStr,
    createdAt: serverTimestamp()
  });
}

/**
 * Clears all scores from the online leaderboard (for management purposes)
 */
export async function clearOnlineLeaderboard() {
  const leaderboardRef = collection(db, "leaderboard");
  const snapshot = await getDocs(leaderboardRef);
  
  const deletePromises = snapshot.docs.map((document) => 
    deleteDoc(doc(db, "leaderboard", document.id))
  );
  
  await Promise.all(deletePromises);
}
