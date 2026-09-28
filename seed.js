const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyABsfBZk0PRDZID91c1vZPHWr6lIeysQ3c',
  authDomain: 'flyggo-internel-portal-3882a.firebaseapp.com',
  projectId: 'flyggo-internel-portal-3882a',
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log('Seeding projects...');
  const projRef = collection(db, 'projects');
  await addDoc(projRef, { name: 'Alpha Platform API', assignee: 'dev1@flyggo.com', status: 'In Progress', progress: 50, dueDate: '2026-09-25' });
  await addDoc(projRef, { name: 'Beta Mobile App', assignee: 'dev2@flyggo.com', status: 'Assigned', progress: 0, dueDate: '2026-10-01' });
  await addDoc(projRef, { name: 'Legacy Migration', assignee: 'dev1@flyggo.com', status: 'Completed', progress: 100, dueDate: '2026-09-10' });
  await addDoc(projRef, { name: 'Data Pipeline', assignee: 'dev3@flyggo.com', status: 'In Progress', progress: 80, dueDate: '2026-09-20' });
  
  console.log('Seeding attendance...');
  // Seed attendance for today for some dummy users
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
  
  await setDoc(doc(db, 'users', 'dummy1', 'attendance', todayStr), {
    date: todayStr,
    email: 'dev1@flyggo.com',
    status: 'Present',
    task: 'Alpha Platform API',
    time: today.toISOString()
  });
  
  await setDoc(doc(db, 'users', 'dummy2', 'attendance', todayStr), {
    date: todayStr,
    email: 'dev2@flyggo.com',
    status: 'Late',
    task: 'Beta Mobile App setup',
    time: today.toISOString()
  });
  
  console.log('Done!');
  process.exit(0);
}
seed().catch(console.error);
