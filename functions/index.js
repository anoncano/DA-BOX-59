const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.deleteAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  const uid = context.auth.uid;
  await admin.firestore().doc(`users/${uid}`).delete().catch(() => {});
  await admin.auth().deleteUser(uid);
  return { deleted: true };
});
