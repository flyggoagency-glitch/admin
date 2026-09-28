
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyABsfBZk0PRDZID91c1vZPHWr6lIeysQ3c',
  authDomain: 'flyggo-internel-portal-3882a.firebaseapp.com',
  projectId: 'flyggo-internel-portal-3882a',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'projects'));
  snap.forEach(d => console.log(d.id, d.data()));
}
run().catch(console.error);
