import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.log('The current browser does not support all of the features required to enable persistence');
    }
  });
} catch(e) {
  console.log(e);
}

