// Firebase Firestore module for history storage
// This module provides cloud storage for user summaries and history

export function initializeFirestore(firebaseApp) {
  // Dynamically import Firestore
  return import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(module => {
    const { getFirestore } = module;
    return getFirestore(firebaseApp);
  });
}

export async function saveToFirestore(db, userId, summary) {
  try {
    const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(m => ({
      collection: m.collection,
      addDoc: m.addDoc,
      serverTimestamp: m.serverTimestamp
    }));

    const summariesRef = collection(db, 'users', userId, 'summaries');
    
    const docRef = await addDoc(summariesRef, {
      title: summary.title || 'Untitled',
      url: summary.url || '',
      summary: summary.summary || '',
      questions: summary.questions || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      success: true,
      id: docRef.id,
      message: 'Summary saved to cloud'
    };
  } catch (error) {
    console.error('Error saving to Firestore:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getFirestoreHistory(db, userId) {
  try {
    const { collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(m => ({
      collection: m.collection,
      query: m.query,
      orderBy: m.orderBy,
      limit: m.limit,
      getDocs: m.getDocs
    }));

    const summariesRef = collection(db, 'users', userId, 'summaries');
    const q = query(summariesRef, orderBy('createdAt', 'desc'), limit(30));
    
    const querySnapshot = await getDocs(q);
    const history = [];

    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      });
    });

    return {
      success: true,
      history: history
    };
  } catch (error) {
    console.error('Error fetching from Firestore:', error);
    return {
      success: false,
      error: error.message,
      history: []
    };
  }
}

export async function updateFirestoreSummary(db, userId, summaryId, updates) {
  try {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(m => ({
      doc: m.doc,
      updateDoc: m.updateDoc
    }));

    const summaryRef = doc(db, 'users', userId, 'summaries', summaryId);
    await updateDoc(summaryRef, updates);

    return {
      success: true,
      message: 'Summary updated'
    };
  } catch (error) {
    console.error('Error updating Firestore:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function deleteFirestoreSummary(db, userId, summaryId) {
  try {
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js').then(m => ({
      doc: m.doc,
      deleteDoc: m.deleteDoc
    }));

    const summaryRef = doc(db, 'users', userId, 'summaries', summaryId);
    await deleteDoc(summaryRef);

    return {
      success: true,
      message: 'Summary deleted'
    };
  } catch (error) {
    console.error('Error deleting from Firestore:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
